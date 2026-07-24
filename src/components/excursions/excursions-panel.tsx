"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bus, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { SessionSummary } from "@/components/settings/sessions-panel";
import { ImportExcursionsDialog } from "@/components/excursions/import-excursions-dialog";

export type ExcursionSummary = {
  id: string;
  sessionId: string;
  name: string;
  destination: string | null;
  notes: string | null;
  capacity: number | null;
  startTime: string;
  endTime: string;
};

type ExcursionsPanelProps = {
  canEdit: boolean;
  sessions: SessionSummary[];
  initialSessionId: string | null;
  initialExcursions: ExcursionSummary[];
};

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWindow(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "—";
  }
  const sameDay = start.toDateString() === end.toDateString();
  const dateFmt: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  const timeFmt: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  if (sameDay) {
    return `${start.toLocaleDateString(undefined, dateFmt)} · ${start.toLocaleTimeString(undefined, timeFmt)}–${end.toLocaleTimeString(undefined, timeFmt)}`;
  }
  return `${start.toLocaleString(undefined, { ...dateFmt, ...timeFmt })} → ${end.toLocaleString(undefined, { ...dateFmt, ...timeFmt })}`;
}

export function ExcursionsPanel({
  canEdit,
  sessions,
  initialSessionId,
  initialExcursions,
}: ExcursionsPanelProps) {
  const router = useRouter();
  const activeFallback =
    sessions.find((row) => row.isActive)?.id ?? sessions[0]?.id ?? "";
  const [sessionId, setSessionId] = useState(
    initialSessionId ?? activeFallback,
  );
  const [excursions, setExcursions] = useState(initialExcursions);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editExcursion, setEditExcursion] = useState<ExcursionSummary | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((row) => row.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  async function loadForSession(nextSessionId: string) {
    const response = await fetch(
      `/api/settings/excursions?sessionId=${encodeURIComponent(nextSessionId)}`,
    );
    if (!response.ok) {
      toast.error("Could not load excursions");
      return;
    }
    const data = await response.json();
    setExcursions(data.excursions ?? []);
    setSessionId(nextSessionId);
  }

  async function createExcursion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const destination = String(form.get("destination") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const capacityRaw = String(form.get("capacity") ?? "").trim();
    const startTime = String(form.get("startTime") ?? "");
    const endTime = String(form.get("endTime") ?? "");

    if (!name || !startTime || !endTime) {
      toast.error("Name, start, and end are required");
      return;
    }

    const capacity = capacityRaw ? Number(capacityRaw) : null;
    if (capacityRaw && (!Number.isInteger(capacity) || (capacity ?? 0) < 1)) {
      toast.error("Capacity must be a positive whole number");
      return;
    }

    setIsSaving(true);
    const response = await fetch("/api/settings/excursions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        name,
        destination: destination || null,
        notes: notes || null,
        capacity,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(
        typeof data.error === "string" ? data.error : "Could not create excursion",
      );
      return;
    }

    const data = await response.json();
    setExcursions((prev) =>
      [...prev, data.excursion].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      ),
    );
    setCreateOpen(false);
    toast.success("Excursion created");
    router.refresh();
  }

  async function updateExcursion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editExcursion) return;

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const destination = String(form.get("destination") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const capacityRaw = String(form.get("capacity") ?? "").trim();
    const startTime = String(form.get("startTime") ?? "");
    const endTime = String(form.get("endTime") ?? "");

    if (!name || !startTime || !endTime) {
      toast.error("Name, start, and end are required");
      return;
    }

    const capacity = capacityRaw ? Number(capacityRaw) : null;
    if (capacityRaw && (!Number.isInteger(capacity) || (capacity ?? 0) < 1)) {
      toast.error("Capacity must be a positive whole number");
      return;
    }

    setIsSaving(true);
    const response = await fetch(
      `/api/settings/excursions/${editExcursion.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          destination: destination || null,
          notes: notes || null,
          capacity,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        }),
      },
    );
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(
        typeof data.error === "string" ? data.error : "Could not update excursion",
      );
      return;
    }

    const data = await response.json();
    setExcursions((prev) =>
      prev
        .map((row) => (row.id === editExcursion.id ? data.excursion : row))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    );
    setEditExcursion(null);
    toast.success("Excursion updated");
    router.refresh();
  }

  async function deleteExcursion(excursion: ExcursionSummary) {
    if (!confirm(`Delete excursion “${excursion.name}”?`)) return;

    const response = await fetch(`/api/settings/excursions/${excursion.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Could not delete excursion");
      return;
    }

    setExcursions((prev) => prev.filter((row) => row.id !== excursion.id));
    toast.success("Excursion deleted");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Excursions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Off-site trips for{" "}
              {selectedSession?.name ?? "the selected session"}. Ties into
              emergency trip GPS — schedule stays for on-campus activities.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessions.length > 1 && (
              <select
                className="min-h-11 rounded-xl border bg-background px-3 text-sm"
                value={sessionId}
                onChange={(event) => void loadForSession(event.target.value)}
              >
                {sessions.map((campSession) => (
                  <option key={campSession.id} value={campSession.id}>
                    {campSession.name}
                    {campSession.isActive ? " (active)" : ""}
                  </option>
                ))}
              </select>
            )}
            {canEdit && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!sessionId}
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="size-4" aria-hidden />
                  Import CSV
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={!sessionId}
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" aria-hidden />
                  Add excursion
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!sessionId ? (
            <p className="text-sm text-muted-foreground">
              Create a camp session first.
            </p>
          ) : excursions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No excursions yet for this session.
            </p>
          ) : (
            <ul className="divide-y rounded-2xl border">
              {excursions.map((excursion) => (
                <li
                  key={excursion.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Bus
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <p className="font-medium">{excursion.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatWindow(excursion.startTime, excursion.endTime)}
                    </p>
                    {excursion.destination && (
                      <p className="text-sm text-muted-foreground">
                        {excursion.destination}
                      </p>
                    )}
                    {(excursion.capacity != null || excursion.notes) && (
                      <p className="text-xs text-muted-foreground">
                        {excursion.capacity != null
                          ? `Capacity ${excursion.capacity}`
                          : null}
                        {excursion.capacity != null && excursion.notes
                          ? " · "
                          : null}
                        {excursion.notes}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10"
                        onClick={() => setEditExcursion(excursion)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-10 text-destructive"
                        onClick={() => void deleteExcursion(excursion)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Delete
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add excursion</DialogTitle>
            <DialogDescription>
              Off-site trip for this session. Staff can attach GPS pings to it
              from Emergency.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={createExcursion}>
            <ExcursionFormFields />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Saving..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editExcursion}
        onOpenChange={(open) => {
          if (!open) setEditExcursion(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit excursion</DialogTitle>
            <DialogDescription>
              Update trip details. Existing GPS pings stay linked if the
              excursion remains.
            </DialogDescription>
          </DialogHeader>
          {editExcursion && (
            <form className="space-y-4" onSubmit={updateExcursion}>
              <ExcursionFormFields excursion={editExcursion} />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setEditExcursion(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="min-h-11" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ImportExcursionsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        sessionId={sessionId}
        onImported={() => void loadForSession(sessionId)}
      />
    </div>
  );
}

function ExcursionFormFields({
  excursion,
}: {
  excursion?: ExcursionSummary;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="excursion-name">Name</Label>
        <Input
          id="excursion-name"
          name="name"
          required
          defaultValue={excursion?.name ?? ""}
          className="min-h-11"
          placeholder="River hike"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="excursion-destination">Destination (optional)</Label>
        <Input
          id="excursion-destination"
          name="destination"
          defaultValue={excursion?.destination ?? ""}
          className="min-h-11"
          placeholder="Pine Creek trailhead"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="excursion-start">Start</Label>
          <Input
            id="excursion-start"
            name="startTime"
            type="datetime-local"
            required
            defaultValue={
              excursion ? toDatetimeLocalValue(excursion.startTime) : ""
            }
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="excursion-end">End</Label>
          <Input
            id="excursion-end"
            name="endTime"
            type="datetime-local"
            required
            defaultValue={
              excursion ? toDatetimeLocalValue(excursion.endTime) : ""
            }
            className="min-h-11"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="excursion-capacity">Capacity (optional)</Label>
        <Input
          id="excursion-capacity"
          name="capacity"
          type="number"
          min={1}
          defaultValue={excursion?.capacity ?? ""}
          className="min-h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="excursion-notes">Notes (optional)</Label>
        <Input
          id="excursion-notes"
          name="notes"
          defaultValue={excursion?.notes ?? ""}
          className="min-h-11"
          placeholder="Bring water bottles"
        />
      </div>
    </>
  );
}
