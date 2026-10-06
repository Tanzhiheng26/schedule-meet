/** A meeting request (iCalendar METHOD:REQUEST), which mail clients show with Accept/Decline. */
export type CalendarInvite = {
  uid: string; // stable per event, so a resend updates the same calendar entry
  sequence: number; // must go up on every resend
  start: string; // ISO
  end: string; // ISO
  title: string;
  description: string;
  organizer: { name: string; email: string };
  attendees: { name: string; email: string; required: boolean }[];
};

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const cn = (name: string) => `"${name.replace(/"/g, "'")}"`;

/** Splits a content line so no line exceeds 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(invite: CalendarInvite, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//schedule-meet//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${invite.uid}`,
    `SEQUENCE:${invite.sequence}`,
    `DTSTAMP:${utc(now.toISOString())}`,
    `DTSTART:${utc(invite.start)}`,
    `DTEND:${utc(invite.end)}`,
    `SUMMARY:${text(invite.title)}`,
    `DESCRIPTION:${text(invite.description)}`,
    `ORGANIZER;CN=${cn(invite.organizer.name)}:mailto:${invite.organizer.email}`,
    ...invite.attendees.map(
      (a) =>
        `ATTENDEE;CN=${cn(a.name)};ROLE=${a.required ? "REQ" : "OPT"}-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`,
    ),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
