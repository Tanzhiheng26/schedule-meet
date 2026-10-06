import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type GridConfig = {
  dates: string[]; // YYYY-MM-DD in the event timezone
  dayStartMin: number;
  dayEndMin: number;
  slotMinutes: number;
  timezone: string;
};

export type Grid = {
  dates: string[];
  times: string[]; // "HH:mm" row labels in the event timezone
  slots: string[][]; // slots[dateIdx][timeIdx] = slot start as a UTC ISO string
};

// slot start ISO -> ids of participants available in that slot
export type BySlot = Record<string, string[]>;

export type RankedSlot = { start: string; end: string; participantIds: string[] };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && min <= 1440 ? min : null;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const MAX_DATES = 31;

/** Parses a comma-separated list of YYYY-MM-DD dates (sorted, deduped), or null if any entry is invalid. */
export function parseDates(raw: string): string[] | null {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const valid = (d: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) &&
    new Date(`${d}T00:00:00Z`).toISOString().startsWith(d); // rejects e.g. 2026-02-30
  return parts.every(valid) ? [...new Set(parts)].sort() : null;
}


// Deterministic (locale-independent) so server and client render identically.
export function dayLabel(date: string): { weekday: string; day: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return { weekday: WEEKDAYS[d.getUTCDay()], day: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
}

export function buildGrid(c: GridConfig): Grid {
  const times: string[] = [];
  for (let m = c.dayStartMin; m + c.slotMinutes <= c.dayEndMin; m += c.slotMinutes) times.push(hhmm(m));
  const dates = [...c.dates].sort();
  const slots = dates.map((d) => times.map((t) => fromZonedTime(`${d}T${t}:00`, c.timezone).toISOString()));
  return { dates, times, slots };
}

export function gridSlotSet(grid: Grid): Set<string> {
  return new Set(grid.slots.flat());
}

export function groupBySlot(rows: { participantId: string; slotStart: Date | string }[]): BySlot {
  const out: BySlot = {};
  for (const r of rows) {
    const iso = typeof r.slotStart === "string" ? r.slotStart : r.slotStart.toISOString();
    (out[iso] ??= []).push(r.participantId);
  }
  return out;
}

const windowLength = (slotMinutes: number, durationMin: number) => Math.max(1, Math.ceil(durationMin / slotMinutes));

function availableInWindow(row: string[], i: number, k: number, bySlot: BySlot): string[] {
  let ids = bySlot[row[i]] ?? [];
  for (let j = 1; j < k && ids.length; j++) {
    const next = new Set(bySlot[row[i + j]] ?? []);
    ids = ids.filter((id) => next.has(id));
  }
  return ids;
}

/** Participants free for the whole meeting starting at `start` (empty if it doesn't fit the grid). */
export function availableFor(grid: Grid, bySlot: BySlot, start: string, slotMinutes: number, durationMin: number): string[] {
  const k = windowLength(slotMinutes, durationMin);
  for (const row of grid.slots) {
    const i = row.indexOf(start);
    if (i !== -1) return i + k <= row.length ? availableInWindow(row, i, k, bySlot) : [];
  }
  return [];
}

/**
 * Meeting start times that fit within a single day. Most required participants free first,
 * then most participants overall, then earliest.
 */
export function rankSlots(
  grid: Grid,
  bySlot: BySlot,
  slotMinutes: number,
  durationMin: number,
  required: ReadonlySet<string> = new Set(),
  limit = 5,
): RankedSlot[] {
  const k = windowLength(slotMinutes, durationMin);
  const out: RankedSlot[] = [];
  for (const row of grid.slots) {
    for (let i = 0; i + k <= row.length; i++) {
      const participantIds = availableInWindow(row, i, k, bySlot);
      if (participantIds.length) out.push({ start: row[i], end: addMinutes(row[i], durationMin), participantIds });
    }
  }
  const requiredCount = (r: RankedSlot) => r.participantIds.filter((id) => required.has(id)).length;
  out.sort(
    (a, b) =>
      requiredCount(b) - requiredCount(a) ||
      b.participantIds.length - a.participantIds.length ||
      a.start.localeCompare(b.start),
  );
  return out.slice(0, limit);
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

export function formatSlot(iso: string, timezone: string, pattern = "EEE d MMM, HH:mm"): string {
  return formatInTimeZone(iso, timezone, pattern);
}

/** Events expire (and are deleted) at midnight after the last candidate day, in the event's time zone. */
export function eventEndsAt(event: { dates: string[]; timezone: string }): Date {
  const last = [...event.dates].sort().at(-1)!;
  const nextDay = new Date(Date.parse(`${last}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return fromZonedTime(`${nextDay}T00:00:00`, event.timezone);
}

/** Automatic reminders go out daily at this hour, in the event's time zone. */
export const REMINDER_HOUR = 9;

/** The calendar date (YYYY-MM-DD) of `d` in time zone `tz`. */
export const localDate = (d: Date, tz: string) => formatInTimeZone(d, tz, "yyyy-MM-dd");

/** A YYYY-MM-DD date for emails, e.g. "Friday 9 October". */
export const longDate = (date: string) => formatInTimeZone(`${date}T00:00:00Z`, "UTC", "EEEE d MMMM");

/** True once the event's respond-by date is over, in the event's time zone. */
export const respondByPassed = (event: { timezone: string; respondBy: string | null }, now: Date) =>
  event.respondBy !== null && localDate(now, event.timezone) > event.respondBy;
const reminderTimeOn = (date: string, tz: string) =>
  fromZonedTime(`${date}T${String(REMINDER_HOUR).padStart(2, "0")}:00:00`, tz);

/**
 * The most recent daily reminder time at or before `now`, or null if it falls on the day the
 * event was created (reminders start the next day) or after the respond-by date (they stop then).
 */
export function latestReminderTime(
  event: { timezone: string; createdAt: Date; respondBy: string | null },
  now: Date,
): Date | null {
  const tz = event.timezone;
  const today = localDate(now, tz);
  let at = reminderTimeOn(today, tz);
  if (at > now) {
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    at = reminderTimeOn(yesterday, tz);
  }
  const day = localDate(at, tz);
  const started = day > localDate(event.createdAt, tz);
  const stopped = event.respondBy !== null && day > event.respondBy;
  return started && !stopped ? at : null;
}
