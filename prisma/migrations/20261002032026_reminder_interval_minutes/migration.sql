-- Reminder interval is now stored in minutes. Convert existing values from hours.
ALTER TABLE "Event" RENAME COLUMN "reminderIntervalHours" TO "reminderIntervalMinutes";
UPDATE "Event" SET "reminderIntervalMinutes" = "reminderIntervalMinutes" * 60;
