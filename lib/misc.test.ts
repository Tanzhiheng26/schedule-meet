import { describe, expect, it } from "vitest";
import { parseParticipants } from "./participants";
import { inviteEmails, meetingPrompt, reminderPrompt } from "./prompts";

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

describe("prompts", () => {
  const event = { title: "Sprint demo", description: "", hostName: "Zhi Heng", hostEmail: "zh@corp.com", timezone: "Asia/Singapore", durationMin: 30 };
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

  it("reminder prompt only includes who it is given", () => {
    const p = reminderPrompt(event, [bob], "https://app.test");
    expect(p).toContain("send the 1 email below");
    expect(p).toContain("https://app.test/e/tokB");
    expect(p).not.toContain("alice@corp.com");
  });

  it("meeting prompt shows times in the event timezone", () => {
    const p = meetingPrompt(event, { start: "2026-10-05T06:00:00.000Z", end: "2026-10-05T06:30:00.000Z" }, [alice, bob]);
    expect(p).toContain("Start: 2026-10-05 14:00");
    expect(p).toContain("End: 2026-10-05 14:30");
    expect(p).toContain("Time zone: Asia/Singapore");
    expect(p).toContain("Required attendees: Zhi Heng <zh@corp.com>; Alice Lee <alice@corp.com>; bob <bob@corp.com>\n");
    expect(p).not.toContain("Optional attendees");
  });

  it("separates optional attendees and tells them in the invite", () => {
    const optionalBob = { ...bob, required: false };
    const slot = { start: "2026-10-05T06:00:00.000Z", end: "2026-10-05T06:30:00.000Z" };
    const p = meetingPrompt(event, slot, [alice, optionalBob]);
    expect(p).toContain("Required attendees: Zhi Heng <zh@corp.com>; Alice Lee <alice@corp.com>\n");
    expect(p).toContain("Optional attendees: bob <bob@corp.com>");
    const invites = inviteEmails(event, [alice, optionalBob], "https://app.test");
    expect(invites.map((e) => e.body.includes("attendance is optional"))).toEqual([false, true]);
  });

  it("lists the host once, as required, even if they added themselves as optional", () => {
    const hostAsOptional = { name: "ZH", email: "ZH@corp.com", required: false };
    const slot = { start: "2026-10-05T06:00:00.000Z", end: "2026-10-05T06:30:00.000Z" };
    const p = meetingPrompt(event, slot, [alice, hostAsOptional]);
    expect(p).toContain("Required attendees: Zhi Heng <zh@corp.com>; Alice Lee <alice@corp.com>\n");
    expect(p).not.toContain("Optional attendees");
    expect(p.match(/zh@corp\.com/gi)).toHaveLength(1);
  });
});
