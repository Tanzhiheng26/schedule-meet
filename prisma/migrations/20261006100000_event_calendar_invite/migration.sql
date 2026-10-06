-- Tracks the emailed calendar invitation, so a resend updates the same calendar entry.
ALTER TABLE "Event" ADD COLUMN "calendarSentAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "calendarSlotStart" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "calendarSequence" INTEGER NOT NULL DEFAULT 0;
