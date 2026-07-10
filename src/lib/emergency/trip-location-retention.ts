import { prisma } from "@/lib/prisma";

/** GPS pings are retained at most 24 hours, then hard-deleted. */
export const TRIP_LOCATION_RETENTION_MS = 24 * 60 * 60 * 1000;

export function tripLocationCutoffDate(now = new Date()) {
  return new Date(now.getTime() - TRIP_LOCATION_RETENTION_MS);
}

export async function purgeExpiredTripLocationCheckIns(now = new Date()) {
  const cutoff = tripLocationCutoffDate(now);
  const result = await prisma.tripLocationCheckIn.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { deleted: result.count, cutoff: cutoff.toISOString() };
}
