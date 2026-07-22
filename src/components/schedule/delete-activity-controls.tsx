"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/design-system/destructive-confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActivityDeleteScope } from "@/lib/schedule/activity-delete";

type DeleteActivityControlsProps = {
  activityId: string;
  activityName: string;
  seriesId: string | null;
  onDeleted: (deletedIds: string[]) => void;
};

type Impact = {
  activityCount: number;
  checkInCount: number;
  activityName: string;
};

const SCOPE_LABELS: Record<ActivityDeleteScope, string> = {
  instance: "Delete just this occurrence",
  future: "Delete this and all future occurrences",
  series: "Delete the entire series",
};

export function DeleteActivityControls({
  activityId,
  activityName,
  seriesId,
  onDeleted,
}: DeleteActivityControlsProps) {
  const [scopeOpen, setScopeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scope, setScope] = useState<ActivityDeleteScope>("instance");
  const [impact, setImpact] = useState<Impact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  function startDelete() {
    if (seriesId) {
      setScope("instance");
      setScopeOpen(true);
      return;
    }
    setScope("instance");
    setConfirmOpen(true);
  }

  useEffect(() => {
    if (!confirmOpen) {
      setImpact(null);
      return;
    }

    let cancelled = false;
    async function loadImpact() {
      setIsLoadingImpact(true);
      const response = await fetch(
        `/api/activities/${activityId}?scope=${scope}`,
      );
      const data = await response.json().catch(() => ({}));
      if (cancelled) return;
      setIsLoadingImpact(false);
      if (!response.ok) {
        toast.error(data.error ?? "Could not load delete details");
        setConfirmOpen(false);
        return;
      }
      setImpact({
        activityCount: data.activityCount ?? 1,
        checkInCount: data.checkInCount ?? 0,
        activityName: data.activityName ?? activityName,
      });
    }
    void loadImpact();
    return () => {
      cancelled = true;
    };
  }, [confirmOpen, activityId, scope, activityName]);

  async function confirmDelete() {
    setIsLoading(true);
    const response = await fetch(`/api/activities/${activityId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    const data = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Could not delete activity");
      return;
    }

    toast.success(
      data.activityCount > 1
        ? `Deleted ${data.activityCount} activities`
        : `"${activityName}" deleted`,
    );
    setConfirmOpen(false);
    setScopeOpen(false);
    onDeleted(data.deletedIds ?? [activityId]);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 text-destructive"
        onClick={startDelete}
      >
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>

      <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete recurring activity</DialogTitle>
            <DialogDescription>
              “{activityName}” is part of a series. Choose what to remove.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(Object.keys(SCOPE_LABELS) as ActivityDeleteScope[]).map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm"
              >
                <input
                  type="radio"
                  className="mt-1"
                  name="delete-scope"
                  checked={scope === value}
                  onChange={() => setScope(value)}
                />
                <span>{SCOPE_LABELS[value]}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setScopeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              onClick={() => {
                setScopeOpen(false);
                setConfirmOpen(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DestructiveConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete activity permanently?"
        confirmLabel={activityName}
        confirmValue={activityName}
        confirmInputLabel="Type the activity name to confirm:"
        actionLabel="Delete permanently"
        isLoading={isLoading || isLoadingImpact}
        onConfirm={confirmDelete}
        description={
          <>
            <p>
              This{" "}
              <strong className="text-foreground">permanently deletes</strong>{" "}
              {impact
                ? impact.activityCount === 1
                  ? "this activity"
                  : `${impact.activityCount} activities`
                : "the selected activities"}
              {seriesId ? ` (${SCOPE_LABELS[scope].toLowerCase()})` : ""}.
            </p>
            {impact && impact.checkInCount > 0 ? (
              <p>
                {impact.checkInCount} check-in
                {impact.checkInCount === 1 ? "" : "s"} linked to{" "}
                {impact.activityCount === 1 ? "this activity" : "these activities"}{" "}
                will be <strong className="text-foreground">kept</strong>, but
                unlinked from the deleted schedule block(s). Attendance history
                is not erased.
              </p>
            ) : (
              <p>No student check-ins are linked to the selected block(s).</p>
            )}
            <p>
              Team schedule links and missing-alert history for these blocks are
              removed.
            </p>
            <p>This cannot be undone.</p>
          </>
        }
      />
    </>
  );
}
