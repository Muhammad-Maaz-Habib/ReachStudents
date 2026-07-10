import Dexie, { type EntityTable } from "dexie";
import type { OfflineCheckInEvent } from "@/lib/checkin/sync";

export type QueuedCheckInEvent = OfflineCheckInEvent & {
  queuedAt: string;
  syncStatus: "pending" | "conflict" | "synced";
  conflictMessage?: string;
};

class WaypointOfflineDB extends Dexie {
  checkInQueue!: EntityTable<QueuedCheckInEvent, "clientEventId">;

  constructor() {
    super("waypoint-offline");
    this.version(1).stores({
      checkInQueue: "clientEventId, studentId, syncStatus, clientTimestamp",
    });
  }
}

export const offlineDb =
  typeof window !== "undefined" ? new WaypointOfflineDB() : null;

export async function queueCheckInEvent(
  event: OfflineCheckInEvent,
): Promise<void> {
  if (!offlineDb) return;

  await offlineDb.checkInQueue.put({
    ...event,
    queuedAt: new Date().toISOString(),
    syncStatus: "pending",
  });
}

export async function getPendingCheckInEvents() {
  if (!offlineDb) return [];
  return offlineDb.checkInQueue
    .where("syncStatus")
    .equals("pending")
    .sortBy("clientTimestamp");
}

export async function getConflictCheckInEvents() {
  if (!offlineDb) return [];
  return offlineDb.checkInQueue.where("syncStatus").equals("conflict").toArray();
}

export async function markEventSynced(clientEventId: string) {
  if (!offlineDb) return;
  await offlineDb.checkInQueue.update(clientEventId, { syncStatus: "synced" });
}

export async function markEventConflict(
  clientEventId: string,
  message: string,
) {
  if (!offlineDb) return;
  await offlineDb.checkInQueue.update(clientEventId, {
    syncStatus: "conflict",
    conflictMessage: message,
  });
}

export async function getPendingCount() {
  if (!offlineDb) return 0;
  return offlineDb.checkInQueue.where("syncStatus").equals("pending").count();
}

export async function dismissConflict(clientEventId: string) {
  if (!offlineDb) return;
  await offlineDb.checkInQueue.delete(clientEventId);
}
