"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getPendingCheckInEvents,
  markEventConflict,
  markEventSynced,
  queueCheckInEvent,
} from "@/lib/offline/checkin-queue";
import type { CheckInEventType } from "@/lib/checkin/sync";

type PerformCheckInArgs = {
  studentId: string;
  type: CheckInEventType;
  staffId: string;
  method?: "tap" | "qr";
  activityId?: string | null;
};

export function useCheckInActions(onSuccess?: () => void) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingCheckInEvents();
    setPendingCount(pending.length);
  }, []);

  const syncPending = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    const pending = await getPendingCheckInEvents();
    if (pending.length === 0) return;

    setIsSyncing(true);
    try {
      const response = await fetch("/api/checkins/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: pending.map(({ syncStatus, queuedAt, conflictMessage, ...event }) => event),
        }),
      });

      const data = await response.json();

      for (const clientEventId of data.applied ?? []) {
        await markEventSynced(clientEventId);
      }
      for (const id of data.idempotent ?? []) {
        await markEventSynced(id);
      }
      for (const conflict of data.conflicts ?? []) {
        await markEventConflict(conflict.clientEventId, conflict.message);
        toast.warning(conflict.message);
      }

      if ((data.applied?.length ?? 0) > 0) {
        toast.success(`Synced ${data.applied.length} offline check-in(s)`);
        onSuccess?.();
      }
    } catch {
      toast.error("Sync failed — will retry when online");
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [isSyncing, onSuccess, refreshPendingCount]);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      void syncPending();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    void refreshPendingCount();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshPendingCount, syncPending]);

  useEffect(() => {
    if (isOnline) void syncPending();
  }, [isOnline, syncPending]);

  async function performCheckIn({
    studentId,
    type,
    staffId,
    method = "tap",
    activityId = null,
  }: PerformCheckInArgs) {
    const clientEventId = crypto.randomUUID();
    const event = {
      clientEventId,
      type,
      studentId,
      activityId,
      staffId,
      method,
      clientTimestamp: new Date().toISOString(),
    };

    if (!navigator.onLine) {
      await queueCheckInEvent(event);
      await refreshPendingCount();
      toast.success(
        type === "check_in"
          ? "Checked in offline — will sync automatically"
          : "Checked out offline — will sync automatically",
      );
      onSuccess?.();
      return { offline: true as const };
    }

    const response = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        type,
        activityId,
        method,
        clientEventId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      toast.error(data.error ?? "Check-in failed");
      return { offline: false as const, error: data.error };
    }

    toast.success(type === "check_in" ? "Checked in" : "Checked out");
    onSuccess?.();
    return { offline: false as const, checkIn: data.checkIn };
  }

  return {
    isOnline,
    pendingCount,
    isSyncing,
    performCheckIn,
    syncPending,
  };
}
