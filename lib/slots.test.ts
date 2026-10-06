import { describe, expect, it } from "vitest";
import {
  availableFor,
  buildGrid,
  eventEndsAt,
  groupBySlot,
  latestReminderTime,
  parseDates,
  parseHHMM,
  rankSlots,
} from "./slots";

describe("parseDates", () => {
  it("sorts and dedupes non-consecutive dates", () => {
    expect(parseDates("2026-10-09, 2026-10-02,2026-10-09")).toEqual(["2026-10-02", "2026-10-09"]);
    expect(parseDates("")).toEqual([]);
  });

  it("rejects malformed or impossible dates", () => {
    expect(parseDates("2026-10-02,nope")).toBeNull();
    expect(parseDates("2026-02-30")).toBeNull();
    expect(parseDates("2026-1-5")).toBeNull();
  });
});

describe("parseHHMM", () => {
  it("parses valid times and rejects invalid ones", () => {
    expect(parseHHMM("09:30")).toBe(570);
    expect(parseHHMM("24:00")).toBe(1440);
    expect(parseHHMM("09:75")).toBeNull();
    expect(parseHHMM("25:00")).toBeNull();
  });
});

describe("buildGrid", () => {
  it("converts local slot times in the event timezone to UTC", () => {
    const grid = buildGrid({
      dates: ["2026-10-05"],
      dayStartMin: 9 * 60,
      dayEndMin: 10 * 60,
      slotMinutes: 30,
      timezone: "Asia/Singapore",
    });
    expect(grid.times).toEqual(["09:00", "09:30"]);
    expect(grid.slots).toEqual([["2026-10-05T01:00:00.000Z", "2026-10-05T01:30:00.000Z"]]);
  });

  it("handles DST changes (New York, 1 Nov 2026)", () => {
    const grid = buildGrid({
      dates: ["2026-10-31", "2026-11-01"],
      dayStartMin: 9 * 60,
      dayEndMin: 9 * 60 + 30,
      slotMinutes: 30,
      timezone: "America/New_York",
    });
    expect(grid.slots[0][0]).toBe("2026-10-31T13:00:00.000Z"); // EDT, UTC-4
    expect(grid.slots[1][0]).toBe("2026-11-01T14:00:00.000Z"); // EST, UTC-5
  });
});

describe("rankSlots", () => {
  const grid = buildGrid({
    dates: ["2026-10-05", "2026-10-06"],
    dayStartMin: 9 * 60,
    dayEndMin: 11 * 60,
    slotMinutes: 30,
    timezone: "UTC",
  });
  const s = (d: string, t: string) => `2026-10-${d}T${t}:00.000Z`;
  const bySlot = groupBySlot([
    // alice: 05 09:00-10:30
    { participantId: "alice", slotStart: s("05", "09:00") },
    { participantId: "alice", slotStart: s("05", "09:30") },
    { participantId: "alice", slotStart: s("05", "10:00") },
    // bob: 05 09:30-10:30, 06 10:00-11:00
    { participantId: "bob", slotStart: s("05", "09:30") },
    { participantId: "bob", slotStart: s("05", "10:00") },
    { participantId: "bob", slotStart: s("06", "10:00") },
    { participantId: "bob", slotStart: s("06", "10:30") },
  ]);

  it("requires availability for every slot of the meeting", () => {
    const ranked = rankSlots(grid, bySlot, 30, 60);
    expect(ranked[0]).toEqual({ start: s("05", "09:30"), end: s("05", "10:30"), participantIds: ["alice", "bob"] });
    expect(ranked.map((r) => r.participantIds.length)).toEqual([2, 1, 1]);
  });

  it("does not let a meeting run past the end of a day", () => {
    const ranked = rankSlots(grid, bySlot, 30, 60, new Set(), 50);
    expect(ranked.some((r) => r.start === s("05", "10:30") || r.start === s("06", "10:30"))).toBe(false);
  });

  it("ranks slots with more required participants free above slots with more people free", () => {
    const withCarol = {
      ...bySlot,
      [s("06", "10:00")]: ["bob", "carol"],
      [s("06", "10:30")]: ["bob", "carol"],
    };
    // carol + bob (06 10:00) beats alice + bob (05 09:30) only when alice is optional
    expect(rankSlots(grid, withCarol, 30, 60, new Set(["bob", "carol"]))[0].start).toBe(s("06", "10:00"));
    expect(rankSlots(grid, withCarol, 30, 60, new Set(["alice", "bob"]))[0].start).toBe(s("05", "09:30"));
  });

  it("availableFor matches the window logic", () => {
    expect(availableFor(grid, bySlot, s("05", "09:30"), 30, 60)).toEqual(["alice", "bob"]);
    expect(availableFor(grid, bySlot, s("05", "09:00"), 30, 60)).toEqual(["alice"]);
    expect(availableFor(grid, bySlot, s("05", "10:30"), 30, 60)).toEqual([]);
  });
});

describe("eventEndsAt", () => {
  it("is midnight after the last candidate day, in the event timezone", () => {
    const event = { dates: ["2026-10-09", "2026-10-05"], timezone: "Asia/Singapore" };
    expect(eventEndsAt(event).toISOString()).toBe("2026-10-09T16:00:00.000Z"); // 10 Oct 00:00 SGT
  });
});

describe("latestReminderTime", () => {
  const tz = "Asia/Singapore"; // UTC+8, so 09:00 local is 01:00Z
  const event = { timezone: tz, createdAt: new Date("2026-10-05T06:00:00Z") }; // 14:00 on 5 Oct, local

  it("sends nothing on the day the event was created", () => {
    expect(latestReminderTime(event, new Date("2026-10-05T15:00:00Z"))).toBeNull(); // 23:00 on 5 Oct
    expect(latestReminderTime(event, new Date("2026-10-06T00:59:00Z"))).toBeNull(); // 08:59 on 6 Oct
  });

  it("is 9am local on each following day", () => {
    expect(latestReminderTime(event, new Date("2026-10-06T01:00:00Z"))?.toISOString()).toBe("2026-10-06T01:00:00.000Z");
    expect(latestReminderTime(event, new Date("2026-10-07T00:30:00Z"))?.toISOString()).toBe("2026-10-06T01:00:00.000Z");
    expect(latestReminderTime(event, new Date("2026-10-07T03:00:00Z"))?.toISOString()).toBe("2026-10-07T01:00:00.000Z");
  });

  it("starts the next day even when created before 9am", () => {
    const early = { timezone: tz, createdAt: new Date("2026-10-04T23:00:00Z") }; // 07:00 on 5 Oct, local
    expect(latestReminderTime(early, new Date("2026-10-05T02:00:00Z"))).toBeNull();
  });
});
