-- Date (YYYY-MM-DD, event time zone) participants are asked to respond by. Null for events created before this.
ALTER TABLE "Event" ADD COLUMN "respondBy" TEXT;
