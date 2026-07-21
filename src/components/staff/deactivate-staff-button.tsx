"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/design-system/destructive-confirm-dialog";

type DeactivateStaffButtonProps = {
  staffId: string;
  staffName: string;
  staffEmail: string;
  onDeactivated: () => void;
};

export function DeactivateStaffButton({
  staffId,
  staffName,
  staffEmail,
  onDeactivated,
}: DeactivateStaffButtonProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function confirmDeactivate() {
    setIsLoading(true);
    const response = await fetch(`/api/staff/${staffId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Could not deactivate staff member");
      return;
    }

    toast.success(`${staffName} deactivated`);
    setOpen(false);
    onDeactivated();
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
        <UserX className="size-3.5" aria-hidden />
        Remove
      </Button>
      <DestructiveConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Deactivate staff account?"
        confirmLabel={staffEmail}
        confirmValue={staffEmail}
        confirmInputLabel="Type their email to confirm:"
        actionLabel="Deactivate account"
        isLoading={isLoading}
        onConfirm={confirmDeactivate}
        description={
          <>
            <p>
              This <strong className="text-foreground">archives</strong>{" "}
              {staffName} ({staffEmail}). They will disappear from the Directory
              and cannot sign in.
            </p>
            <p>
              Team assignments for this session are cleared. Shifts, swap
              history, check-ins they recorded, and messages are{" "}
              <strong className="text-foreground">kept</strong> for audit trail.
            </p>
            <p>This is not a hard delete of historical records.</p>
          </>
        }
      />
    </>
  );
}
