"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBaseUrl } from "@/lib/baseUrl";
import { purgeExpiredEvents } from "@/lib/cleanup";
import { prisma } from "@/lib/db";
import { emailConfigured, type SendResult, sendEmails } from "@/lib/mailer";
import { isEmail, parseParticipants } from "@/lib/participants";
import { buildIcs } from "@/lib/calendar";
import { calendarEmails, inviteEmails, meetingAttendees, meetingBody } from "@/lib/emails";
import { remindPending } from "@/lib/reminders";
import {
  addMinutes,
  buildGrid,
  eventEndsAt,
  gridSlotSet,
  isValidTimezone,
  localDate,
  longDate,
  MAX_DATES,
  parseDates,
  parseHHMM,
  respondByPassed,
} from "@/lib/slots";
import { newToken } from "@/lib/tokens";

export type CreateEventState = { error?: string };

const MAX_PARTICIPANTS = 100;

export async function createEvent(_prev: CreateEventState, form: FormData): Promise<CreateEventState> {
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const int = (k: string) => Number.parseInt(str(k), 10);

  const title = str("title");
  const hostName = str("hostName");
  const hostEmail = str("hostEmail").toLowerCase();
  const timezone = str("timezone");
  const dates = parseDates(str("dates"));
  const respondBy = parseDates(str("respondBy"))?.[0];
  const dayStartMin = parseHHMM(str("dayStart"));
  const dayEndMin = parseHHMM(str("dayEnd"));
  const durationMin = int("durationMin");
  const required = parseParticipants(str("participants"));
  const optional = parseParticipants(str("optionalParticipants"));
  const invalid = [...required.invalid, ...optional.invalid];
  // Anyone listed in both is treated as required.
  const requiredEmails = new Set(required.participants.map((p) => p.email));
  const participants = [
    ...required.participants.map((p) => ({ ...p, required: true })),
    ...optional.participants.filter((p) => !requiredEmails.has(p.email)).map((p) => ({ ...p, required: false })),
  ];

  if (!title || title.length > 200) return { error: "Please enter a title (up to 200 characters)." };
  if (!hostName) return { error: "Please enter your name." };
  if (!isEmail(hostEmail)) return { error: "Please enter a valid email for yourself." };
  if (!isValidTimezone(timezone)) return { error: `Unknown time zone "${timezone}".` };
  if (!dates) return { error: "Some of the selected dates are invalid." };
  if (dates.length === 0) return { error: "Pick at least one day for the meeting." };
  if (dates.length > MAX_DATES) return { error: `Pick at most ${MAX_DATES} days.` };
  if (!respondBy) return { error: "Pick a respond-by date." };
  if (respondBy < localDate(new Date(), timezone)) return { error: "The respond-by date can't be in the past." };
  if (respondBy > dates.at(-1)!)
    return { error: `The respond-by date must be on or before the last possible day (${longDate(dates.at(-1)!)}).` };
  if (dayStartMin === null || dayEndMin === null || dayEndMin <= dayStartMin)
    return { error: "The daily end time must be after the start time." };
  if (!(durationMin >= 15 && durationMin <= dayEndMin - dayStartMin))
    return { error: "The meeting length must fit within the daily hours." };
  if (invalid.length) return { error: `These don't look like email addresses: ${invalid.join(", ")}` };
  if (requiredEmails.size === 0) return { error: "Add at least one required participant." };
  if (participants.length > MAX_PARTICIPANTS) return { error: `At most ${MAX_PARTICIPANTS} participants.` };

  await purgeExpiredEvents();
  const event = await prisma.event.create({
    data: {
      adminToken: newToken(),
      expiresAt: eventEndsAt({ dates, timezone }),
      title,
      description: str("description"),
      hostName,
      hostEmail,
      timezone,
      dates,
      dayStartMin,
      dayEndMin,
      durationMin,
      respondBy,
      participants: { create: participants.map((p) => ({ ...p, token: newToken() })) },
    },
  });
  // Anyone who couldn't be emailed is listed on the host page, with a button to retry.
  await deliverInvites(event.adminToken);
  redirect(`/host/${event.adminToken}`);
}

export async function saveAvailability(token: string, slots: string[]): Promise<void> {
  const participant = await prisma.participant.findUnique({ where: { token }, include: { event: true } });
  if (!participant) throw new Error("Unknown participant link.");

  const valid = gridSlotSet(buildGrid(participant.event));
  const chosen = [...new Set(slots)].filter((s) => valid.has(s));

  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { participantId: participant.id } }),
    prisma.availability.createMany({
      data: chosen.map((s) => ({ participantId: participant.id, slotStart: new Date(s) })),
    }),
    prisma.participant.update({ where: { id: participant.id }, data: { respondedAt: new Date() } }),
  ]);
  revalidatePath(`/e/${token}`);
  revalidatePath(`/host/${participant.event.adminToken}`);
}

async function updateEvent(adminToken: string, data: Parameters<typeof prisma.event.update>[0]["data"]) {
  await prisma.event.update({ where: { adminToken }, data });
  revalidatePath(`/host/${adminToken}`);
}

export type SendState = { message?: string; error?: string };

const NOT_CONFIGURED = "Automatic email isn't set up: set GMAIL_USER and GMAIL_APP_PASSWORD.";

async function loadEvent(adminToken: string) {
  const event = await prisma.event.findUnique({
    where: { adminToken },
    include: { participants: { orderBy: { name: "asc" } } },
  });
  if (!event) throw new Error("Unknown event.");
  return event;
}

function summarize(kind: string, total: number, { sent, failed, error }: SendResult): SendState {
  const sentMsg = sent.length ? `Sent ${kind} to ${sent.length} of ${total}.` : "";
  return failed.length ? { error: `${sentMsg} Couldn't email ${failed.join(", ")}. ${error ?? ""}`.trim() } : { message: sentMsg };
}

/** Emails an invite to each participant who hasn't had one yet, and records who got it. */
async function deliverInvites(adminToken: string): Promise<SendState> {
  if (!emailConfigured()) return { error: NOT_CONFIGURED };
  const event = await loadEvent(adminToken);
  const uninvited = event.participants.filter((p) => !p.invitedAt);
  if (uninvited.length === 0) return { message: "Everyone has been invited." };

  const host = { name: event.hostName, email: event.hostEmail };
  const result = await sendEmails(host, inviteEmails(event, uninvited, await getBaseUrl()));
  await prisma.participant.updateMany({
    where: { eventId: event.id, email: { in: result.sent } },
    data: { invitedAt: new Date() },
  });
  revalidatePath(`/host/${adminToken}`);
  return summarize("invites", uninvited.length, result);
}

/** Retries invites for anyone the automatic send on event creation missed. */
export async function sendInvites(adminToken: string): Promise<SendState> {
  return deliverInvites(adminToken);
}

/** Emails a reminder now to each invited participant who hasn't responded. */
export async function sendReminders(adminToken: string): Promise<SendState> {
  if (!emailConfigured()) return { error: NOT_CONFIGURED };
  const event = await loadEvent(adminToken);
  if (event.calendarSentAt) return { error: "The calendar invitation has gone out, so reminders have stopped." };
  if (respondByPassed(event, new Date())) return { error: "The respond-by date has passed, so reminders have stopped." };
  const total = event.participants.filter((p) => p.invitedAt && !p.respondedAt).length;
  if (total === 0) return { error: "There's nobody to remind." };

  const result = await remindPending(event, await getBaseUrl());
  if (result.sent.length) await updateEvent(adminToken, { lastReminderAt: new Date() });
  return summarize("reminders", total, result);
}

export async function chooseSlot(adminToken: string, slotStart: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { adminToken },
    include: { participants: { where: { required: true, respondedAt: null }, select: { id: true } } },
  });
  if (!event || !gridSlotSet(buildGrid(event)).has(slotStart)) throw new Error("Invalid slot.");
  if (event.participants.length) throw new Error("Wait until all required participants have responded.");
  await updateEvent(adminToken, { finalSlotStart: new Date(slotStart) });
}

/**
 * Emails a calendar invitation for `slotStart` to the host and every participant, and makes it the
 * chosen time. Sending again (e.g. after changing the time) updates the same calendar entry.
 */
export async function sendCalendarInvite(adminToken: string, slotStart: string): Promise<SendState> {
  if (!emailConfigured()) return { error: NOT_CONFIGURED };
  const event = await loadEvent(adminToken);
  if (!gridSlotSet(buildGrid(event)).has(slotStart)) return { error: "That time isn't one of the options." };
  if (event.participants.some((p) => p.required && !p.respondedAt))
    return { error: "Wait until all required participants have responded." };

  const slot = { start: slotStart, end: addMinutes(slotStart, event.durationMin) };
  const { required, optional } = meetingAttendees(event, event.participants);
  const ics = buildIcs({
    uid: `${event.id}@schedule-meet`,
    sequence: event.calendarSequence,
    ...slot,
    title: event.title,
    description: meetingBody(event),
    organizer: { name: event.hostName, email: event.hostEmail },
    attendees: [
      ...required.map((a) => ({ ...a, required: true })),
      ...optional.map((a) => ({ ...a, required: false })),
    ],
  });
  const emails = calendarEmails(event, slot, event.participants, ics, event.calendarSentAt !== null);
  const result = await sendEmails({ name: event.hostName, email: event.hostEmail }, emails);
  if (result.sent.length) {
    await updateEvent(adminToken, {
      finalSlotStart: new Date(slotStart),
      calendarSentAt: new Date(),
      calendarSlotStart: new Date(slotStart),
      calendarSequence: { increment: 1 },
    });
  }
  return summarize("the calendar invitation", emails.length, result);
}

export async function toggleRequired(adminToken: string, participantId: string): Promise<void> {
  const participant = await prisma.participant.findFirst({ where: { id: participantId, event: { adminToken } } });
  if (!participant) throw new Error("Unknown participant.");
  await prisma.participant.update({ where: { id: participantId }, data: { required: !participant.required } });
  revalidatePath(`/host/${adminToken}`);
}
