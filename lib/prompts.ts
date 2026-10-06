import { formatSlot, longDate } from "./slots";

export type PromptEvent = {
  title: string;
  description: string;
  hostName: string;
  hostEmail: string;
  timezone: string;
  durationMin: number;
  respondBy: string | null;
};

export type PromptRecipient = { name: string; email: string; token: string; required?: boolean };
export type PromptAttendee = { name: string; email: string; required?: boolean };

/** One personal email; `link` is the recipient's availability link (also in the body), used for the QR code. */
export type Email = { to: string; subject: string; body: string; link: string };

export const participantLink = (baseUrl: string, token: string) => `${baseUrl}/e/${token}`;

const firstName = (name: string) => name.split(/\s+/)[0] || name;

export function inviteEmails(event: PromptEvent, recipients: PromptRecipient[], baseUrl: string): Email[] {
  return recipients.map((r) => {
    const link = participantLink(baseUrl, r.token);
    return {
      to: r.email,
      link,
      subject: `When are you free for "${event.title}"?`,
      body: [
        `Hi ${firstName(r.name)},`,
        "",
        `I'm scheduling "${event.title}" (${event.durationMin} min) and would like to find a time that works for everyone.`,
        ...(r.required === false ? ["Your attendance is optional, but it helps to know when you're free."] : []),
        ...(event.description ? ["", event.description] : []),
        "",
        event.respondBy
          ? `Please mark your availability by ${longDate(event.respondBy)} (it takes about a minute):`
          : "Please mark your availability here (it takes about a minute):",
        link,
        "",
        "This link is personal to you, so please don't forward it.",
        "",
        "Thanks,",
        event.hostName,
      ].join("\n"),
    };
  });
}

export function reminderEmails(event: PromptEvent, pending: PromptRecipient[], baseUrl: string): Email[] {
  return pending.map((r) => {
    const link = participantLink(baseUrl, r.token);
    return {
      to: r.email,
      link,
      subject: `Reminder: your availability for "${event.title}"`,
      body: [
        `Hi ${firstName(r.name)},`,
        "",
        `A quick reminder to mark your availability for "${event.title}"${event.respondBy ? ` by ${longDate(event.respondBy)}` : ""}. I'm still waiting on a few responses before I can book a time.`,
        "",
        link,
        "",
        "Thanks,",
        event.hostName,
      ].join("\n"),
    };
  });
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
