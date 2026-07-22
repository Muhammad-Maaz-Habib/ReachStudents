"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/design-system/destructive-confirm-dialog";

type DeleteFormButtonProps = {
  formId: string;
  formTitle: string;
  submissionCount: number;
  isTemplate?: boolean;
  onDeleted?: () => void;
};

export function DeleteFormButton({
  formId,
  formTitle,
  submissionCount,
  isTemplate = false,
  onDeleted,
}: DeleteFormButtonProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function confirmDelete() {
    setIsLoading(true);
    const response = await fetch(`/api/forms/${formId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Could not delete form");
      return;
    }

    toast.success(
      typeof data.message === "string"
        ? data.message
        : isTemplate
          ? "Template archived"
          : "Form unpublished",
    );
    setOpen(false);
    onDeleted?.();
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
        {isTemplate ? "Delete template" : "Delete"}
      </Button>
      <DestructiveConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={
          isTemplate
            ? "Archive custom template?"
            : "Unpublish form from this session?"
        }
        confirmLabel={formTitle}
        confirmValue={formTitle}
        confirmInputLabel="Type the form title to confirm:"
        actionLabel={isTemplate ? "Archive template" : "Unpublish form"}
        isLoading={isLoading}
        onConfirm={confirmDelete}
        description={
          isTemplate ? (
            <>
              <p>
                This <strong className="text-foreground">archives</strong> the
                reusable template so it no longer appears in the library.
              </p>
              <p>
                Copies already published to sessions are{" "}
                <strong className="text-foreground">not</strong> removed — delete
                those separately if needed.
              </p>
              <p>
                No parent submissions are attached to the template itself; this
                does not erase signed responses on published copies.
              </p>
            </>
          ) : (
            <>
              <p>
                This <strong className="text-foreground">unpublishes</strong> the
                form: parents will no longer see it as pending, and staff will
                not see it in the active session list.
              </p>
              <p>
                {submissionCount > 0 ? (
                  <>
                    <strong className="text-foreground">
                      {submissionCount} submission
                      {submissionCount === 1 ? "" : "s"}
                    </strong>{" "}
                    (responses and signatures) are{" "}
                    <strong className="text-foreground">kept</strong> for
                    compliance — they are not deleted.
                  </>
                ) : (
                  <>
                    There are no submissions yet. The form record is archived
                    rather than hard-deleted so the action stays reversible in
                    the database.
                  </>
                )}
              </p>
              <p>Only session admins and super admins can do this.</p>
            </>
          )
        }
      />
    </>
  );
}
