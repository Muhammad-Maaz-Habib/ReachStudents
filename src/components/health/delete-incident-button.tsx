"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/design-system/destructive-confirm-dialog";

type DeleteIncidentButtonProps = {
  incidentId: string;
  incidentTitle: string;
  hasParentThread: boolean;
  onDeleted?: () => void;
};

export function DeleteIncidentButton({
  incidentId,
  incidentTitle,
  hasParentThread,
  onDeleted,
}: DeleteIncidentButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function confirmDelete() {
    setIsLoading(true);
    const response = await fetch(`/api/incidents/${incidentId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Could not delete incident");
      return;
    }

    toast.success("Incident deleted");
    setOpen(false);
    onDeleted?.();
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" aria-hidden />
        Delete
      </Button>
      <DestructiveConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete incident report permanently?"
        confirmLabel={incidentTitle}
        confirmValue={incidentTitle}
        confirmInputLabel="Type the incident title to confirm:"
        actionLabel="Delete permanently"
        isLoading={isLoading}
        onConfirm={confirmDelete}
        description={
          <>
            <p>
              This{" "}
              <strong className="text-foreground">permanently deletes</strong>{" "}
              this safety/compliance incident report from the active session.
            </p>
            <p>
              An <strong className="text-foreground">audit log entry</strong> is
              written before deletion (title, severity, reporter, and related
              counts) so there is still a compliance trail.
            </p>
            {hasParentThread ? (
              <p>
                Linked parent message threads are{" "}
                <strong className="text-foreground">kept</strong> and only
                unlinked from this report — conversation history is not deleted.
              </p>
            ) : (
              <p>No parent thread is linked to this report.</p>
            )}
            <p>
              Filing staff cannot delete their own reports — only session admins
              and super admins can. This cannot be undone.
            </p>
          </>
        }
      />
    </>
  );
}
