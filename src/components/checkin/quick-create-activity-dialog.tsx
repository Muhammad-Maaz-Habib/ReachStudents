"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  nextActivityColor,
  normalizeActivityColor,
} from "@/lib/schedule/activity-colors";

type TeamOption = { id: string; name: string };

export type CreatedActivity = {
  id: string;
  name: string;
  location: string | null;
  startTime: string;
  endTime: string;
  teamId: string | null;
  color: string | null;
};

type QuickCreateActivityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamOption[];
  existingColors?: (string | null | undefined)[];
  onCreated: (activity: CreatedActivity) => void;
  triggerLabel?: string;
  showTrigger?: boolean;
};

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function QuickCreateActivityDialog({
  open,
  onOpenChange,
  teams,
  existingColors = [],
  onCreated,
  triggerLabel = "New activity",
  showTrigger = false,
}: QuickCreateActivityDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [startLocal, setStartLocal] = useState(() =>
    toDatetimeLocalValue(new Date()),
  );
  const [durationMinutes, setDurationMinutes] = useState(60);

  function resetDefaults() {
    setName("");
    setTeamId("");
    setStartLocal(toDatetimeLocalValue(new Date()));
    setDurationMinutes(60);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const start = new Date(startLocal);
    if (Number.isNaN(start.getTime())) {
      toast.error("Invalid start time");
      return;
    }
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const color = normalizeActivityColor(nextActivityColor(existingColors));

    setIsSaving(true);
    const response = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        teamId: teamId || undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        overdueAlertMinutes: 15,
        color,
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not create activity");
      return;
    }

    const data = (await response.json()) as { activity: CreatedActivity & { teamId?: string | null } };
    toast.success(`Started "${data.activity.name}"`);
    onCreated({
      id: data.activity.id,
      name: data.activity.name,
      location: data.activity.location ?? null,
      startTime:
        typeof data.activity.startTime === "string"
          ? data.activity.startTime
          : new Date(data.activity.startTime).toISOString(),
      endTime:
        typeof data.activity.endTime === "string"
          ? data.activity.endTime
          : new Date(data.activity.endTime).toISOString(),
      teamId: data.activity.teamId ?? (teamId || null),
      color: data.activity.color ?? color,
    });
    resetDefaults();
    onOpenChange(false);
  }

  return (
    <>
      {showTrigger && (
        <Button
          type="button"
          className="min-h-11"
          onClick={() => {
            resetDefaults();
            onOpenChange(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {triggerLabel}
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) resetDefaults();
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick create activity</DialogTitle>
            <DialogDescription>
              Creates a real schedule activity (same as /schedule) so you can
              start roll call immediately. Defaults to starting now.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-activity-name">Name</Label>
              <Input
                id="quick-activity-name"
                className="min-h-11"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Cabin meeting"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-activity-team">Team / group (optional)</Label>
              <select
                id="quick-activity-team"
                className="min-h-11 w-full rounded-xl border bg-background px-3"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                <option value="">All eligible students</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-activity-start">Starts</Label>
                <Input
                  id="quick-activity-start"
                  type="datetime-local"
                  className="min-h-11"
                  value={startLocal}
                  onChange={(event) => setStartLocal(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-activity-duration">Duration (minutes)</Label>
                <Input
                  id="quick-activity-duration"
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  className="min-h-11"
                  value={durationMinutes}
                  onChange={(event) =>
                    setDurationMinutes(Number(event.target.value) || 60)
                  }
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Creating..." : "Create & start roll call"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
