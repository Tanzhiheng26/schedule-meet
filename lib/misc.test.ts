import { describe, expect, it } from "vitest";
import { parseParticipants } from "./participants";
import { inviteEmails, meetingPrompt, reminderEmails } from "./prompts";

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
