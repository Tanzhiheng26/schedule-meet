-- Events are deleted at midnight after their last candidate day, in the event's time zone.
ALTER TABLE "Event" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill existing events. Prisma stores DateTime as UTC without a time zone.
UPDATE "Event"
SET "expiresAt" = (((SELECT max(d)::date FROM unnest("dates") AS d) + 1)::timestamp AT TIME ZONE "timezone") AT TIME ZONE 'UTC';

ALTER TABLE "Event" ALTER COLUMN "expiresAt" SET NOT NULL;

CREATE INDEX "Event_expiresAt_idx" ON "Event"("expiresAt");
