import { formatSlot, longDate } from "./slots";

export type EmailEvent = {
  title: string;
  description: string;
  hostName: string;
  hostEmail: string;
  timezone: string;
  durationMin: number;
  respondBy: string | null;
};

export type EmailRecipient = { name: string; email: string; token: string; required?: boolean };
export type Attendee = { name: string; email: string; required?: boolean };

/**
 * One personal email. `link` is the recipient's availability link (also in the body), sent as a QR code;
 * `calendar` is an iCalendar meeting request, sent so mail clients offer Accept/Decline.
 */
export type Email = { to: string; subject: string; body: string; link?: string; calendar?: string };

export const participantLink = (baseUrl: string, token: string) => `${baseUrl}/e/${token}`;

const firstName = (name: string) => name.split(/\s+/)[0] || name;

export function inviteEmails(event: EmailEvent, recipients: EmailRecipient[], baseUrl: string): Email[] {
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

export function reminderEmails(event: EmailEvent, pending: EmailRecipient[], baseUrl: string): Email[] {
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

export function meetingBody(event: EmailEvent): string {
  return event.description || `${event.title}, scheduled with the help of schedule-meet.`;
}

/** The host is always a required attendee, listed once even if they also added themselves as a participant. */
export function meetingAttendees(event: EmailEvent, attendees: Attendee[]) {
  const host = { name: event.hostName, email: event.hostEmail };
  const others = attendees.filter((a) => a.email.toLowerCase() !== host.email.toLowerCase());
  return {
    required: [host, ...others.filter((a) => a.required !== false)],
    optional: others.filter((a) => a.required === false),
  };
}

type Slot = { start: string; end: string };

const slotText = (slot: Slot, tz: string) =>
  `${formatSlot(slot.start, tz, "EEEE d MMMM, HH:mm")}–${formatSlot(slot.end, tz, "HH:mm")} (${tz})`;

/** One email per attendee (including the host), each carrying the same meeting request. */
export function calendarEmails(
  event: EmailEvent,
  slot: Slot,
  attendees: Attendee[],
  calendar: string,
  isUpdate: boolean,
): Email[] {
  const { required, optional } = meetingAttendees(event, attendees);
  return [...required, ...optional].map((a) => ({
    to: a.email,
    calendar,
    subject: `${isUpdate ? "Updated invitation" : "Invitation"}: ${event.title} · ${formatSlot(slot.start, event.timezone, "EEE d MMM, HH:mm")}`,
    body: [
      `Hi ${firstName(a.name)},`,
      "",
      `"${event.title}" ${isUpdate ? "has been updated and is now" : "is booked for"} ${slotText(slot, event.timezone)}.`,
      ...(event.description ? ["", event.description] : []),
      "",
      "The calendar invitation is attached. Please accept it to add the meeting to your calendar.",
      "",
      "Thanks,",
      event.hostName,
    ].join("\n"),
  }));
}
