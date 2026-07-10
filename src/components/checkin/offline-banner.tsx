"use client";

import { WifiOff, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";

type OfflineBannerProps = {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSync: () => void;
};

export function OfflineBanner({
  isOnline,
  pendingCount,
  isSyncing,
  onSync,
}: OfflineBannerProps) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <WifiOff className="size-4 shrink-0" aria-hidden />
          <span>
            {!isOnline
              ? "You're offline — changes will sync automatically when you're back online."
              : `${pendingCount} offline check-in${pendingCount === 1 ? "" : "s"} waiting to sync.`}
          </span>
        </div>
        {isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="min-h-9"
            disabled={isSyncing}
            onClick={onSync}
            aria-label={isSyncing ? "Syncing offline check-ins" : "Sync offline check-ins now"}
          >
            <CloudUpload className="size-4" aria-hidden />
            {isSyncing ? "Syncing..." : "Sync now"}
          </Button>
        )}
      </div>
    </div>
  );
}
