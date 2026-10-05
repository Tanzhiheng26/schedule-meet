import { prisma } from "./db";

/**
 * Deletes events whose last candidate day has passed. Participants and availability go with
 * them via ON DELETE CASCADE. Called when an event is created (the only time the table grows)
 * and when a host or participant page loads, so expired links stop working on time.
 */
export async function purgeExpiredEvents(): Promise<number> {
  const { count } = await prisma.event.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return count;
}
