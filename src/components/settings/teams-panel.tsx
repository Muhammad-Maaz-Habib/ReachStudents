"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
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
import {
  ACTIVITY_COLOR_PALETTE,
  nextActivityColor,
} from "@/lib/schedule/activity-colors";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "@/components/settings/sessions-panel";

type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
};

type StaffAssignment = {
  id: string;
  isLead: boolean;
  user: { id: string; name: string | null; email: string };
};

export type TeamSummary = {
  id: string;
  sessionId: string;
  name: string;
  color: string | null;
  students: TeamMember[];
  staff: StaffAssignment[];
  _count: { students: number; staff: number };
};

type TeamsPanelProps = {
  canEdit: boolean;
  sessions: SessionSummary[];
  initialSessionId: string | null;
  initialTeams: TeamSummary[];
};

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="listbox" aria-label="Team color">
      {ACTIVITY_COLOR_PALETTE.map((color) => {
        const selected = value.toUpperCase() === color.toUpperCase();
        return (
          <button
            key={color}
            type="button"
            role="option"
            aria-selected={selected}
            className={cn(
              "size-9 rounded-full border-2 transition-transform",
              selected
                ? "scale-110 border-foreground"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            aria-label={`Color ${color}`}
          />
        );
      })}
    </div>
  );
}

export function TeamsPanel({
  canEdit,
  sessions,
  initialSessionId,
  initialTeams,
}: TeamsPanelProps) {
  const router = useRouter();
  const activeFallback = sessions.find((row) => row.isActive)?.id ?? sessions[0]?.id ?? "";
  const [sessionId, setSessionId] = useState(initialSessionId ?? activeFallback);
  const [teams, setTeams] = useState(initialTeams);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamSummary | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<TeamSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createColor, setCreateColor] = useState<string>(() =>
    nextActivityColor(initialTeams.map((team) => team.color)),
  );
  const [editColor, setEditColor] = useState<string>("#E07A3A");

  const selectedSession = useMemo(
    () => sessions.find((row) => row.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  async function loadTeamsForSession(nextSessionId: string) {
    setSessionId(nextSessionId);
    setExpandedId(null);
    const response = await fetch(
      `/api/settings/teams?sessionId=${encodeURIComponent(nextSessionId)}`,
    );
    if (!response.ok) {
      toast.error("Could not load teams");
      return;
    }
    const data = (await response.json()) as { teams: TeamSummary[] };
    setTeams(data.teams);
    setCreateColor(nextActivityColor(data.teams.map((team) => team.color)));
  }

  async function createTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !sessionId) return;

    const formData = new FormData(event.currentTarget);
    setIsSaving(true);
    const response = await fetch("/api/settings/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        name: String(formData.get("name") ?? ""),
        color: createColor,
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not create team");
      return;
    }

    const data = (await response.json()) as { team: TeamSummary };
    setTeams((current) =>
      [...current, data.team].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setCreateOpen(false);
    toast.success(`Team "${data.team.name}" created`);
    router.refresh();
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !editTeam) return;

    const formData = new FormData(event.currentTarget);
    setIsSaving(true);
    const response = await fetch(`/api/settings/teams/${editTeam.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        color: editColor,
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not update team");
      return;
    }

    const data = (await response.json()) as { team: TeamSummary };
    setTeams((current) =>
      current
        .map((row) => (row.id === data.team.id ? data.team : row))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setEditTeam(null);
    toast.success("Team updated");
    router.refresh();
  }

  async function confirmDelete(force: boolean) {
    if (!canEdit || !deleteTeam) return;

    setIsSaving(true);
    const url = force
      ? `/api/settings/teams/${deleteTeam.id}?force=true`
      : `/api/settings/teams/${deleteTeam.id}`;
    const response = await fetch(url, { method: "DELETE" });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && !force) {
        toast.error(data.error ?? "Students are still assigned");
        return;
      }
      toast.error(data.error ?? "Could not delete team");
      return;
    }

    setTeams((current) => current.filter((row) => row.id !== deleteTeam.id));
    setDeleteTeam(null);
    toast.success(
      force
        ? `Deleted "${deleteTeam.name}" and unassigned students`
        : `Deleted "${deleteTeam.name}"`,
    );
    router.refresh();
  }

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="size-5" aria-hidden />
              Teams
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              CSV roster import matches the <code className="text-xs">team</code>{" "}
              column to these names (case-insensitive).
            </p>
          </div>
          {canEdit && sessionId && (
            <Button
              type="button"
              className="min-h-11 shrink-0"
              onClick={() => {
                setCreateColor(nextActivityColor(teams.map((team) => team.color)));
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Add team
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a session first, then add teams here.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="teams-session">Session</Label>
                <select
                  id="teams-session"
                  className="min-h-11 w-full max-w-md rounded-xl border bg-background px-3"
                  value={sessionId}
                  onChange={(event) => void loadTeamsForSession(event.target.value)}
                >
                  {sessions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                      {row.isActive ? " (active)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No teams in {selectedSession?.name ?? "this session"} yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {teams.map((team) => {
                    const expanded = expandedId === team.id;
                    return (
                      <li
                        key={team.id}
                        className="rounded-xl border bg-muted/30 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2 p-3">
                          <button
                            type="button"
                            className="flex min-h-11 flex-1 items-center gap-2 text-left"
                            onClick={() =>
                              setExpandedId(expanded ? null : team.id)
                            }
                            aria-expanded={expanded}
                          >
                            {expanded ? (
                              <ChevronDown className="size-4 shrink-0" aria-hidden />
                            ) : (
                              <ChevronRight className="size-4 shrink-0" aria-hidden />
                            )}
                            <span
                              className="size-3.5 shrink-0 rounded-full border"
                              style={{
                                backgroundColor: team.color ?? "#9CA3AF",
                              }}
                              aria-hidden
                            />
                            <span className="font-medium">{team.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {team._count.students} students · {team._count.staff}{" "}
                              staff
                            </span>
                          </button>
                          {canEdit && (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-h-10"
                                onClick={() => {
                                  setEditTeam(team);
                                  setEditColor(team.color ?? "#E07A3A");
                                }}
                              >
                                <Pencil className="size-3.5" aria-hidden />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-h-10 text-destructive"
                                onClick={() => setDeleteTeam(team)}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                        {expanded && (
                          <div className="grid gap-4 border-t px-3 py-3 sm:grid-cols-2">
                            <div>
                              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Students
                              </p>
                              {team.students.length === 0 ? (
                                <p className="text-muted-foreground">None assigned</p>
                              ) : (
                                <ul className="max-h-40 space-y-1 overflow-y-auto">
                                  {team.students.map((student) => (
                                    <li key={student.id}>
                                      {student.lastName}, {student.firstName}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Staff
                              </p>
                              {team.staff.length === 0 ? (
                                <p className="text-muted-foreground">None assigned</p>
                              ) : (
                                <ul className="max-h-40 space-y-1 overflow-y-auto">
                                  {team.staff.map((assignment) => (
                                    <li key={assignment.id}>
                                      {assignment.user.name ?? assignment.user.email}
                                      {assignment.isLead ? " (lead)" : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
            <DialogDescription>
              Name must match your roster CSV team column exactly (case can differ).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void createTeam(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Name</Label>
              <Input id="team-name" name="name" required className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={createColor} onChange={setCreateColor} />
            </div>
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Saving..." : "Create team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTeam}
        onOpenChange={(open) => {
          if (!open) setEditTeam(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit team</DialogTitle>
            <DialogDescription>
              Renaming updates future CSV matches; existing students stay assigned.
            </DialogDescription>
          </DialogHeader>
          {editTeam && (
            <form onSubmit={(event) => void saveEdit(event)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-team-name">Name</Label>
                <Input
                  id="edit-team-name"
                  name="name"
                  required
                  className="min-h-11"
                  defaultValue={editTeam.name}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <ColorPicker value={editColor} onChange={setEditColor} />
              </div>
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
        open={!!deleteTeam}
        onOpenChange={(open) => {
          if (!open) setDeleteTeam(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete team?</DialogTitle>
            <DialogDescription>
              {deleteTeam && deleteTeam._count.students > 0
                ? `"${deleteTeam.name}" has ${deleteTeam._count.students} student(s) assigned. Delete is blocked unless you force-unassign them.`
                : `This removes "${deleteTeam?.name}" from the session. Staff assignments are also removed.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setDeleteTeam(null)}
            >
              Cancel
            </Button>
            {deleteTeam && deleteTeam._count.students > 0 ? (
              <Button
                type="button"
                variant="destructive"
                className="min-h-11"
                disabled={isSaving}
                onClick={() => void confirmDelete(true)}
              >
                {isSaving ? "Deleting..." : "Unassign students & delete"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                className="min-h-11"
                disabled={isSaving}
                onClick={() => void confirmDelete(false)}
              >
                {isSaving ? "Deleting..." : "Delete team"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
