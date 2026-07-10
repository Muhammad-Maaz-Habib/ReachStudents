"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type ConfidentialNotesCardProps = {
  medicalProfileId: string;
  initialNotes: string | null;
  canEdit: boolean;
};

export function ConfidentialNotesCard({
  medicalProfileId,
  initialNotes,
  canEdit,
}: ConfidentialNotesCardProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function saveNotes(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    const response = await fetch(
      `/api/health/profiles/${medicalProfileId}/confidential`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confidentialNotes: notes }),
      },
    );

    setIsSaving(false);
    if (!response.ok) {
      toast.error("Could not save confidential notes");
      return;
    }
    toast.success("Confidential notes saved");
    router.refresh();
  }

  return (
    <Card className="rounded-2xl border-amber-200/60 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lock className="size-5 text-amber-700" aria-hidden />
          Confidential notes
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Visible to Session Admin and Nurse only — not shown on the general medical
          profile or to counselors.
        </p>
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <form onSubmit={saveNotes} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="confidential-notes">Internal health notes</Label>
              <textarea
                id="confidential-notes"
                className="min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <Button type="submit" className="min-h-11" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save confidential notes"}
            </Button>
          </form>
        ) : (
          <p className="whitespace-pre-wrap text-sm">
            {notes || "No confidential notes on file."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
