-- Existing participants stay required.
ALTER TABLE "Participant" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
