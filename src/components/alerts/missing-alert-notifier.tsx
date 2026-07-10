"use client";

import { useEffect } from "react";
import { toast } from "sonner";

type MissingAlertNotifierProps = {
  enabled?: boolean;
  intervalMs?: number;
};

export function MissingAlertNotifier({
  enabled = true,
  intervalMs = 60_000,
}: MissingAlertNotifierProps) {
  useEffect(() => {
    if (!enabled) return;

    async function notify() {
      const response = await fetch("/api/alerts/missing/notify", {
        method: "POST",
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.dispatched > 0) {
        toast.warning(
          `Staff notified: ${data.dispatched} missing check-in alert(s) sent via SMS/email/push`,
        );
      }
    }

    void notify();
    const interval = setInterval(notify, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, intervalMs]);

  return null;
}
