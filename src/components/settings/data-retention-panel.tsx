"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RetentionPolicy = "NONE" | "ARCHIVE" | "DELETE";

type DataRetentionPanelProps = {
  canEdit: boolean;
  initialPolicy: RetentionPolicy;
  initialDaysAfterEnd: number;
};

export function DataRetentionPanel({
  canEdit,
  initialPolicy,
  initialDaysAfterEnd,
}: DataRetentionPanelProps) {
  const [policy, setPolicy] = useState<RetentionPolicy>(initialPolicy);
  const [daysAfterEnd, setDaysAfterEnd] = useState(initialDaysAfterEnd);
  const [isSaving, setIsSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;

    setIsSaving(true);
    const response = await fetch("/api/settings/retention", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionDataRetentionPolicy: policy,
        sessionDataRetentionDaysAfterEnd: daysAfterEnd,
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      toast.error("Could not save retention policy");
      return;
    }
    toast.success("Retention policy saved");
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Archive className="size-5" aria-hidden />
          Session data retention
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Auto-archive or delete session data N days after the session end date.
          A daily cron job applies this policy (`/api/cron/session-retention`).
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void save(event)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="retention-policy">Policy</Label>
            <select
              id="retention-policy"
              className="min-h-11 w-full max-w-md rounded-xl border bg-background px-3"
              value={policy}
              disabled={!canEdit}
              onChange={(event) => setPolicy(event.target.value as RetentionPolicy)}
            >
              <option value="NONE">None — keep all session data</option>
              <option value="ARCHIVE">Archive — mark session inactive after N days</option>
              <option value="DELETE">Delete — remove session and cascaded data after N days</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="retention-days">Days after session end</Label>
            <Input
              id="retention-days"
              type="number"
              min={1}
              max={3650}
              value={daysAfterEnd}
              disabled={!canEdit || policy === "NONE"}
              onChange={(event) =>
                setDaysAfterEnd(Math.max(1, Number(event.target.value) || 90))
              }
              className="min-h-11"
            />
          </div>
          {canEdit && (
            <div className="flex items-end">
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save retention policy"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
