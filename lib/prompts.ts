import { formatSlot } from "./slots";

export type PromptEvent = {
  title: string;
  description: string;
  hostName: string;
  hostEmail: string;
  timezone: string;
  durationMin: number;
};

export type PromptRecipient = { name: string; email: string; token: string; required?: boolean };
export type PromptAttendee = { name: string; email: string; required?: boolean };

type Email = { to: string; subject: string; body: string };

export const participantLink = (baseUrl: string, token: string) => `${baseUrl}/e/${token}`;

const firstName = (name: string) => name.split(/\s+/)[0] || name;

function emailBatchPrompt(emails: Email[]): string {
  const n = emails.length;
  const header = [
    `Using the Outlook Email app, send the ${n} email${n === 1 ? "" : "s"} below from my mailbox.`,
    "",
    "Rules:",
    "- Send each email separately, only to the recipient listed for it.",
    "- Use the subject and body exactly as written. Do not rewrite, summarize, or shorten them, and keep every link unchanged.",
    "- Send as plain text.",
    "- For each email, generate a QR code image of the availability link in that email's body and attach it as a PNG file.",
    "- When you're done, list the recipients you sent to.",
  ].join("\n");
  const blocks = emails.map((e, i) =>
    [`=== Email ${i + 1} of ${n} ===`, `To: ${e.to}`, `Subject: ${e.subject}`, "Body:", e.body].join("\n"),
  );
  return [header, ...blocks].join("\n\n");
}

export function invitePrompt(event: PromptEvent, recipients: PromptRecipient[], baseUrl: string): string {
  return emailBatchPrompt(
    recipients.map((r) => ({
      to: r.email,
      subject: `When are you free for "${event.title}"?`,
      body: [
        `Hi ${firstName(r.name)},`,
        "",
        `I'm scheduling "${event.title}" (${event.durationMin} min) and would like to find a time that works for everyone.`,
        ...(r.required === false ? ["Your attendance is optional, but it helps to know when you're free."] : []),
        ...(event.description ? ["", event.description] : []),
        "",
        "Please mark your availability here (it takes about a minute):",
        participantLink(baseUrl, r.token),
        "",
        "This link is personal to you, so please don't forward it.",
        "",
        "Thanks,",
        event.hostName,
      ].join("\n"),
    })),
  );
}

export function reminderPrompt(event: PromptEvent, pending: PromptRecipient[], baseUrl: string): string {
  return emailBatchPrompt(
    pending.map((r) => ({
      to: r.email,
      subject: `Reminder: your availability for "${event.title}"`,
      body: [
        `Hi ${firstName(r.name)},`,
        "",
        `A quick reminder to mark your availability for "${event.title}". I'm still waiting on a few responses before I can book a time.`,
        "",
        participantLink(baseUrl, r.token),
        "",
        "Thanks,",
        event.hostName,
      ].join("\n"),
    })),
  );
}

function meetingBody(event: PromptEvent): string {
  return event.description || `${event.title}, scheduled with the help of schedule-meet.`;
}

export function meetingPrompt(
  event: PromptEvent,
  slot: { start: string; end: string },
  attendees: PromptAttendee[],
): string {
  const tz = event.timezone;
  const list = (as: PromptAttendee[]) => as.map((a) => `${a.name} <${a.email}>`).join("; ");
  // The host is always a required attendee, listed once even if they also added themselves as a participant.
  const host = { name: event.hostName, email: event.hostEmail };
  const others = attendees.filter((a) => a.email.toLowerCase() !== host.email.toLowerCase());
  const optional = others.filter((a) => a.required === false);
  const required = [host, ...others.filter((a) => a.required !== false)];
  return [
    "Using the Outlook Calendar app, create a meeting on my calendar and send the invitation to the attendees.",
    "",
    `Title: ${event.title}`,
    `Date: ${formatSlot(slot.start, tz, "EEEE d MMMM yyyy")}`,
    `Start: ${formatSlot(slot.start, tz, "yyyy-MM-dd HH:mm")}`,
    `End: ${formatSlot(slot.end, tz, "yyyy-MM-dd HH:mm")}`,
    `Time zone: ${tz}`,
    `Required attendees: ${list(required)}`,
    ...(optional.length ? [`Optional attendees: ${list(optional)}`] : []),
    "Location: TBC",
    "Body:",
    meetingBody(event),
    "",
  ].join("\n");
}
