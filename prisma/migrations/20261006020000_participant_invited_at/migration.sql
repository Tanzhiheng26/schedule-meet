-- Invites are now emailed per participant, so track them per participant.
ALTER TABLE "Participant" ADD COLUMN "invitedAt" TIMESTAMP(3);

-- Backfill: participants of events whose invites were marked as sent count as invited.
UPDATE "Participant" p SET "invitedAt" = e."invitesSentAt" FROM "Event" e WHERE p."eventId" = e.id;

ALTER TABLE "Event" DROP COLUMN "invitesSentAt";
