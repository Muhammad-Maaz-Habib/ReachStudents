"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Pencil, Plus, Star } from "lucide-react";
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
  const [isSaving, setIsSaving] = useState(false);

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    const formData = new FormData(event.currentTarget);
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
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not create session");
      return;
    }

    const data = (await response.json()) as { session: SessionSummary };
    setSessions((current) => {
      const next = data.session.isActive
        ? current.map((row) => ({ ...row, isActive: false }))
        : current;
      return [data.session, ...next];
    });
    setCreateOpen(false);
    toast.success("Session created");
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
              Roster import and schedules use the active session.
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
              Creating an active session deactivates other sessions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void createSession(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-name">Name</Label>
              <Input id="session-name" name="name" required className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-description">Description (optional)</Label>
              <Input id="session-description" name="description" className="min-h-11" />
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
            <form onSubmit={(event) => void saveEdit(event)} className="space-y-4">
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
    </>
  );
}
