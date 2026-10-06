import { configuredBaseUrl } from "./baseUrl";
import { prisma } from "./db";
import { emailConfigured, type SendResult, sendEmails } from "./mailer";
import { reminderEmails } from "./emails";
import { latestReminderTime } from "./slots";

type ReminderEvent = {
  title: string;
  description: string;
  hostName: string;
  hostEmail: string;
  timezone: string;
  durationMin: number;
  respondBy: string | null;
  participants: { name: string; email: string; token: string; invitedAt: Date | null; respondedAt: Date | null }[];
};

/** Emails a reminder to each invited participant who hasn't responded. */
export function remindPending(event: ReminderEvent, baseUrl: string): Promise<SendResult> {
  const pending = event.participants.filter((p) => p.invitedAt && !p.respondedAt);
  return sendEmails({ name: event.hostName, email: event.hostEmail }, reminderEmails(event, pending, baseUrl));
}

/**
 * Sends today's reminder for every event that is due one: it's past the daily reminder hour, the
 * respond-by date hasn't passed, no calendar invitation has gone out, someone invited hasn't responded, and no reminder (automatic or
 * manual) went out since then.
 */
export async function sendDueReminders(now = new Date()): Promise<void> {
  if (!emailConfigured()) return;
  const events = await prisma.event.findMany({
    where: {
      expiresAt: { gt: now },
      calendarSentAt: null, // the meeting is booked
      participants: { some: { invitedAt: { not: null }, respondedAt: null } },
    },
    include: { participants: true },
  });
  for (const event of events) {
    const dueAt = latestReminderTime(event, now);
    if (!dueAt) continue;
    // Claim the reminder first so a second server process (or a slow previous run) can't send it twice.
    const { count } = await prisma.event.updateMany({
      where: { id: event.id, OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: dueAt } }] },
      data: { lastReminderAt: now },
    });
    if (count === 0) continue;
    const { sent, failed } = await remindPending(event, configuredBaseUrl());
    console.log(`Daily reminder for "${event.title}": sent ${sent.length}, failed ${failed.length}.`);
  }
}

/** Checks for due reminders every minute while the server runs. */
export function startReminderScheduler(): void {
  const g = globalThis as { reminderTimer?: NodeJS.Timeout };
  if (g.reminderTimer) return; // the dev server can load this more than once
  const tick = () => sendDueReminders().catch((err) => console.error("Daily reminders failed:", err));
  g.reminderTimer = setInterval(tick, 60_000);
  tick();
}
