"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/design-system/destructive-confirm-dialog";

type DeleteStudentButtonProps = {
  studentId: string;
  studentName: string;
};

export function DeleteStudentButton({
  studentId,
  studentName,
}: DeleteStudentButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function confirmDelete() {
    setIsLoading(true);
    const response = await fetch(`/api/students/${studentId}`, {
      method: "DELETE",
    });
    setIsLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not delete student");
      return;
    }

    toast.success(`${studentName} deleted`);
    setOpen(false);
    router.push("/roster");
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>
      <DestructiveConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete student permanently?"
        confirmLabel={studentName}
        confirmValue={studentName}
        confirmInputLabel="Type the student's full name to confirm:"
        actionLabel="Delete permanently"
        isLoading={isLoading}
        onConfirm={confirmDelete}
        description={
          <>
            <p>
              This <strong className="text-foreground">permanently deletes</strong>{" "}
              {studentName} from the roster.
            </p>
            <p>
              Also removed: medical profile, emergency contacts, check-ins, form
              submissions, wellness checks, parent message threads, and schedule
              links.
            </p>
            <p>
              Incident reports that mentioned this student are <strong className="text-foreground">kept</strong>,
              but the student is unlinked from them.
            </p>
            <p>This cannot be undone.</p>
          </>
        }
      />
    </>
  );
}
