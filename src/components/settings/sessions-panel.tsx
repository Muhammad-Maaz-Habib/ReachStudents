"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Eraser, Pencil, Plus, Star } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

export type SessionSummary = {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  _count: { teams: number; students: number };
};

type SessionsPanelProps = {
  canEdit: boolean;
  initialSessions: SessionSummary[];
};

function toDateInput(value: string) {
  return value.slice(0, 10);
}

export function SessionsPanel({ canEdit, initialSessions }: SessionsPanelProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [createOpen, setCreateOpen] = useState(false);
  const [editSession, setEditSession] = useState<SessionSummary | null>(null);
  const [resetSession, setResetSession] = useState<SessionSummary | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    const formData = new FormData(event.currentTarget);
    const copyFrom = String(formData.get("copyStructureFromSessionId") ?? "");
    setIsSaving(true);
    const response = await fetch("/api/settings/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "") || undefined,
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        isActive: formData.get("isActive") === "on",
        copyStructureFromSessionId: copyFrom || undefined,
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(
        typeof data.error === "string" ? data.error : "Could not create session",
      );
      return;
    }

    const data = (await response.json()) as {
      session: SessionSummary;
      clone?: { cloned: { teams: number } } | null;
    };
    setSessions((current) => {
      const next = data.session.isActive
        ? current.map((row) => ({ ...row, isActive: false }))
        : current;
      return [data.session, ...next];
    });
    setCreateOpen(false);
    if (data.clone?.cloned) {
      toast.success(
        `Session created with structure (${data.clone.cloned.teams} teams)`,
      );
    } else {
      toast.success("Session created");
    }
    router.refresh();
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !editSession) return;

    const formData = new FormData(event.currentTarget);
    setIsSaving(true);
    const response = await fetch(`/api/settings/sessions/${editSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "") || null,
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        isActive: formData.get("isActive") === "on",
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(
        typeof data.error === "string" ? data.error : "Could not update session",
      );
      return;
    }

    const data = (await response.json()) as { session: SessionSummary };
    setSessions((current) =>
      current.map((row) => {
        if (row.id === data.session.id) return data.session;
        if (data.session.isActive) return { ...row, isActive: false };
        return row;
      }),
    );
    setEditSession(null);
    toast.success("Session updated");
    router.refresh();
  }

  async function setActive(sessionId: string) {
    if (!canEdit) return;
    const response = await fetch(`/api/settings/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    if (!response.ok) {
      toast.error("Could not activate session");
      return;
    }
    const data = (await response.json()) as { session: SessionSummary };
    setSessions((current) =>
      current.map((row) => ({
        ...row,
        isActive: row.id === data.session.id,
      })),
    );
    toast.success(`"${data.session.name}" is now the active session`);
    router.refresh();
  }

  async function confirmReset() {
    if (!canEdit || !resetSession) return;
    if (confirmName.trim() !== resetSession.name) {
      toast.error("Type the exact session name to confirm");
      return;
    }

    setIsSaving(true);
    const response = await fetch(
      `/api/settings/sessions/${resetSession.id}/reset`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName }),
      },
    );
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(
        typeof data.error === "string" ? data.error : "Could not reset session",
      );
      return;
    }

    const data = (await response.json()) as { session: SessionSummary };
    setSessions((current) =>
      current.map((row) => (row.id === data.session.id ? data.session : row)),
    );
    setResetSession(null);
    setConfirmName("");
    toast.success("Session operational data cleared");
    router.refresh();
  }

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5" aria-hidden />
              Sessions
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Roster import and schedules use the active session. Reset clears
              students and ops data; create can copy structure from a prior
              session.
            </p>
          </div>
          {canEdit && (
            <Button
              type="button"
              className="min-h-11 shrink-0"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Add session
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sessions yet. Create one to start adding teams and students.
            </p>
          ) : (
            sessions.map((campSession) => (
              <div
                key={campSession.id}
                className="rounded-xl border bg-muted/30 p-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{campSession.name}</p>
                      {campSession.isActive && (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {new Date(campSession.startDate).toLocaleDateString()} –{" "}
                      {new Date(campSession.endDate).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {campSession._count.teams} teams ·{" "}
                      {campSession._count.students} students
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      {!campSession.isActive && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-10"
                          onClick={() => void setActive(campSession.id)}
                        >
                          <Star className="size-3.5" aria-hidden />
                          Set active
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10"
                        onClick={() => setEditSession(campSession)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10 text-destructive"
                        onClick={() => {
                          setConfirmName("");
                          setResetSession(campSession);
                        }}
                      >
                        <Eraser className="size-3.5" aria-hidden />
                        Reset data
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New session</DialogTitle>
            <DialogDescription>
              Creating an active session deactivates other sessions. Optionally
              copy Teams, Mentor Groups, Clubs, schedule, excursions, duty
              shifts, and session forms — never students or history.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => void createSession(event)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="session-name">Name</Label>
              <Input id="session-name" name="name" required className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-description">Description (optional)</Label>
              <Input
                id="session-description"
                name="description"
                className="min-h-11"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session-start">Start date</Label>
                <Input
                  id="session-start"
                  name="startDate"
                  type="date"
                  required
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-end">End date</Label>
                <Input
                  id="session-end"
                  name="endDate"
                  type="date"
                  required
                  className="min-h-11"
                />
              </div>
            </div>
            {sessions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="copy-structure">
                  Copy structure from (optional)
                </Label>
                <select
                  id="copy-structure"
                  name="copyStructureFromSessionId"
                  className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">Start empty</option>
                  {sessions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Dates on activities, excursions, and shifts shift by the
                  difference between the source start date and this session’s
                  start date.
                </p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="size-4 rounded border"
              />
              Set as active session
            </label>
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Saving..." : "Create session"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editSession}
        onOpenChange={(open) => {
          if (!open) setEditSession(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
            <DialogDescription>
              Update dates or activate this session for roster import.
            </DialogDescription>
          </DialogHeader>
          {editSession && (
            <form
              onSubmit={(event) => void saveEdit(event)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="edit-session-name">Name</Label>
                <Input
                  id="edit-session-name"
                  name="name"
                  required
                  className="min-h-11"
                  defaultValue={editSession.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-session-description">Description</Label>
                <Input
                  id="edit-session-description"
                  name="description"
                  className="min-h-11"
                  defaultValue={editSession.description ?? ""}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-session-start">Start date</Label>
                  <Input
                    id="edit-session-start"
                    name="startDate"
                    type="date"
                    required
                    className="min-h-11"
                    defaultValue={toDateInput(editSession.startDate)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-session-end">End date</Label>
                  <Input
                    id="edit-session-end"
                    name="endDate"
                    type="date"
                    required
                    className="min-h-11"
                    defaultValue={toDateInput(editSession.endDate)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={editSession.isActive}
                  className="size-4 rounded border"
                />
                Active session
              </label>
              <DialogFooter>
                <Button type="submit" className="min-h-11" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetSession}
        onOpenChange={(open) => {
          if (!open) {
            setResetSession(null);
            setConfirmName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reset session data</DialogTitle>
            <DialogDescription>
              Destructive wipe of operational data for{" "}
              <strong>{resetSession?.name}</strong>. The session row stays; you
              can reuse it for the next cohort.
            </DialogDescription>
          </DialogHeader>
          {resetSession && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <p className="font-medium text-destructive">Will be deleted</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>All students (medical, parents, wellness, club memberships)</li>
                  <li>Check-ins, incidents, parent message threads</li>
                  <li>Session forms + submissions (org templates kept)</li>
                  <li>Session announcements + staff chat messages</li>
                  <li>On-campus activities / series + duty shifts / swaps</li>
                  <li>Trip GPS pings</li>
                </ul>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                <p className="font-medium">Preserved</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>This session (name and dates)</li>
                  <li>Teams + staff assignments</li>
                  <li>Mentor Groups + mentors (roster cleared)</li>
                  <li>Clubs + advisors (memberships cleared)</li>
                  <li>Excursion definitions</li>
                  <li>Empty staff chat channels recreated</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm">
                  Type <span className="font-medium">{resetSession.name}</span>{" "}
                  to confirm
                </Label>
                <Input
                  id="reset-confirm"
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                  className="min-h-11"
                  autoComplete="off"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setResetSession(null);
                    setConfirmName("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11"
                  disabled={
                    isSaving || confirmName.trim() !== resetSession.name
                  }
                  onClick={() => void confirmReset()}
                >
                  {isSaving ? "Resetting..." : "Reset session data"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
