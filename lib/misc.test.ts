import { describe, expect, it } from "vitest";
import { parseParticipants } from "./participants";
import { buildIcs } from "./calendar";
import { calendarEmails, inviteEmails, meetingAttendees, reminderEmails } from "./emails";

describe("parseParticipants", () => {
  it("handles Outlook-style lists, bare emails, duplicates, and invalid entries", () => {
    const { participants, invalid } = parseParticipants(
      "Tan, Zhi Heng <ZH@corp.com>; alice@corp.com, bob@corp.com\nzh@corp.com\nnot-an-email",
    );
    expect(participants).toEqual([
      { name: "Tan, Zhi Heng", email: "zh@corp.com" },
      { name: "alice", email: "alice@corp.com" },
      { name: "bob", email: "bob@corp.com" },
    ]);
    expect(invalid).toEqual(["not-an-email"]);
  });
});

describe("emails", () => {
  const event = { title: "Sprint demo", description: "", hostName: "Zhi Heng", hostEmail: "zh@corp.com", timezone: "Asia/Singapore", durationMin: 30, respondBy: null };
  const alice = { name: "Alice Lee", email: "alice@corp.com", token: "tokA" };
  const bob = { name: "bob", email: "bob@corp.com", token: "tokB" };

  it("invite emails are personal: one per recipient, with their own link for the QR code", () => {
    const emails = inviteEmails(event, [alice, bob], "https://app.test");
    expect(emails.map((e) => [e.to, e.link])).toEqual([
      ["alice@corp.com", "https://app.test/e/tokA"],
      ["bob@corp.com", "https://app.test/e/tokB"],
    ]);
    expect(emails[0].body).toContain("Hi Alice,");
    expect(emails[0].body).toContain("https://app.test/e/tokA");
    expect(emails[0].body).not.toContain("tokB");
  });

  it("invite and reminder emails include the respond-by date when there is one", () => {
    const dated = { ...event, respondBy: "2026-10-09" };
    expect(inviteEmails(dated, [alice], "https://app.test")[0].body).toContain(
      "Please mark your availability by Friday 9 October",
    );
    expect(reminderEmails(dated, [alice], "https://app.test")[0].body).toContain(
      'mark your availability for "Sprint demo" by Friday 9 October.',
    );
    expect(inviteEmails(event, [alice], "https://app.test")[0].body).not.toContain(" by ");
  });

  it("reminder emails go only to who they are given", () => {
    const emails = reminderEmails(event, [bob], "https://app.test");
    expect(emails.map((e) => e.to)).toEqual(["bob@corp.com"]);
    expect(emails[0].body).toContain("https://app.test/e/tokB");
  });

  it("separates optional attendees and tells them in the invite", () => {
    const optionalBob = { ...bob, required: false };
    const names = (as: { email: string }[]) => as.map((a) => a.email);
    const { required, optional } = meetingAttendees(event, [alice, optionalBob]);
    expect(names(required)).toEqual(["zh@corp.com", "alice@corp.com"]);
    expect(names(optional)).toEqual(["bob@corp.com"]);
    const invites = inviteEmails(event, [alice, optionalBob], "https://app.test");
    expect(invites.map((e) => e.body.includes("attendance is optional"))).toEqual([false, true]);
  });

  it("lists the host once, as required, even if they added themselves as optional", () => {
    const hostAsOptional = { name: "ZH", email: "ZH@corp.com", required: false };
    const { required, optional } = meetingAttendees(event, [alice, hostAsOptional]);
    expect(required.map((a) => a.email)).toEqual(["zh@corp.com", "alice@corp.com"]);
    expect(optional).toEqual([]);
  });
});

describe("calendar invitation", () => {
  const invite = {
    uid: "evt1@schedule-meet",
    sequence: 2,
    start: "2026-10-08T06:00:00.000Z",
    end: "2026-10-08T07:00:00.000Z",
    title: "Sprint demo; Q4, part 1",
    description: "Line one\nLine two",
    organizer: { name: "Zhi Heng", email: "zh@corp.com" },
    attendees: [
      { name: "Tan, Alice", email: "alice@corp.com", required: true },
      { name: "Bob", email: "bob@corp.com", required: false },
    ],
  };

  it("is a meeting request with escaped text, UTC times, and attendee roles", () => {
    const ics = buildIcs(invite, new Date("2026-10-06T00:00:00Z"));
    expect(ics).toContain("METHOD:REQUEST\r\n");
    expect(ics).toContain("UID:evt1@schedule-meet\r\nSEQUENCE:2\r\nDTSTAMP:20261006T000000Z\r\n");
    expect(ics).toContain("DTSTART:20261008T060000Z\r\nDTEND:20261008T070000Z\r\n");
    expect(ics).toContain("SUMMARY:Sprint demo\\; Q4\\, part 1\r\n");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\r\n");
    expect(ics).toContain('ORGANIZER;CN="Zhi Heng":mailto:zh@corp.com');
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain('ATTENDEE;CN="Tan, Alice";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:alice@corp.com');
    expect(unfolded).toContain("ROLE=OPT-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:bob@corp.com");
  });

  it("folds long lines to at most 75 octets", () => {
    const ics = buildIcs({ ...invite, description: "é".repeat(200) });
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain(`DESCRIPTION:${"é".repeat(200)}\r\n`);
  });

  it("emails the host and each participant once, in the event time zone", () => {
    const event = { title: "Sprint demo", description: "", hostName: "Zhi Heng", hostEmail: "zh@corp.com", timezone: "Asia/Singapore", durationMin: 60, respondBy: null };
    const alice = { name: "Alice Lee", email: "alice@corp.com" };
    const bob = { name: "bob", email: "bob@corp.com" };
    const slot = { start: "2026-10-08T06:00:00.000Z", end: "2026-10-08T07:00:00.000Z" };
    const hostToo = { name: "ZH", email: "ZH@corp.com" };
    const emails = calendarEmails(event, slot, [alice, { ...bob, required: false }, hostToo], "ICS", false);
    expect(emails.map((e) => e.to)).toEqual(["zh@corp.com", "alice@corp.com", "bob@corp.com"]);
    expect(emails.every((e) => e.calendar === "ICS" && !e.link)).toBe(true);
    expect(emails[1].subject).toBe("Invitation: Sprint demo · Thu 8 Oct, 14:00");
    expect(emails[1].body).toContain('"Sprint demo" is booked for Thursday 8 October, 14:00–15:00 (Asia/Singapore).');
    const update = calendarEmails(event, slot, [alice], "ICS", true)[0];
    expect(update.subject).toMatch(/^Updated invitation: /);
    expect(update.body).toContain("has been updated and is now Thursday 8 October");
  });
});
