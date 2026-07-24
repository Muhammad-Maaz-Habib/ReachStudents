"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Trash2, Upload, Users } from "lucide-react";
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
import { ImportClubsDialog } from "@/components/clubs/import-clubs-dialog";

type StaffOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type StudentOption = {
  id: string;
  firstName: string;
  lastName: string;
  team: { name: string } | null;
  clubMemberships?: { clubId: string }[];
};

export type ClubSummary = {
  id: string;
  sessionId: string;
  name: string;
  advisors: StaffOption[];
  students: {
    id: string;
    firstName: string;
    lastName: string;
    teamId: string | null;
  }[];
  _count: { memberships: number; advisors: number };
};

type ClubsPanelProps = {
  canEdit: boolean;
  sessions: SessionSummary[];
  initialSessionId: string | null;
  initialClubs: ClubSummary[];
  staffOptions: StaffOption[];
  studentOptions: StudentOption[];
};

export function ClubsPanel({
  canEdit,
  sessions,
  initialSessionId,
  initialClubs,
  staffOptions,
  studentOptions: initialStudents,
}: ClubsPanelProps) {
  const router = useRouter();
  const activeFallback =
    sessions.find((row) => row.isActive)?.id ?? sessions[0]?.id ?? "";
  const [sessionId, setSessionId] = useState(
    initialSessionId ?? activeFallback,
  );
  const [clubs, setClubs] = useState(initialClubs);
  const [students, setStudents] = useState(initialStudents);
  const [staff] = useState(staffOptions);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editClub, setEditClub] = useState<ClubSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((row) => row.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  async function loadForSession(nextSessionId: string) {
    const response = await fetch(
      `/api/settings/clubs?sessionId=${encodeURIComponent(nextSessionId)}`,
    );
    if (!response.ok) {
      toast.error("Could not load clubs");
      return;
    }
    const data = await response.json();
    setClubs(data.clubs ?? []);
    setStudents(data.studentOptions ?? []);
    setSessionId(nextSessionId);
    setExpandedId(null);
  }

  async function createClub(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const advisorIds = form.getAll("advisorIds").map(String);
    const studentIds = form.getAll("studentIds").map(String);

    if (!name || advisorIds.length === 0) {
      toast.error("Name and at least one advisor are required");
      return;
    }
    if (advisorIds.length > 3) {
      toast.error("Choose at most 3 advisors");
      return;
    }

    setIsSaving(true);
    const response = await fetch("/api/settings/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, name, advisorIds, studentIds }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not create club");
      return;
    }

    toast.success("Club created");
    setCreateOpen(false);
    await loadForSession(sessionId);
    router.refresh();
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editClub) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const advisorIds = form.getAll("advisorIds").map(String);
    const studentIds = form.getAll("studentIds").map(String);

    if (advisorIds.length === 0 || advisorIds.length > 3) {
      toast.error("Choose 1–3 advisors");
      return;
    }

    setIsSaving(true);
    const response = await fetch(`/api/settings/clubs/${editClub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, advisorIds, studentIds }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not update club");
      return;
    }

    toast.success("Club updated");
    setEditClub(null);
    await loadForSession(sessionId);
    router.refresh();
  }

  async function deleteClub(club: ClubSummary) {
    if (
      !window.confirm(
        `Delete club “${club.name}”? Students stay on the roster; they are only removed from this club.`,
      )
    ) {
      return;
    }

    const response = await fetch(`/api/settings/clubs/${club.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Could not delete club");
      return;
    }
    toast.success("Club deleted");
    await loadForSession(sessionId);
    router.refresh();
  }

  function advisorCheckboxList(selectedIds: Set<string>) {
    return (
      <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border p-3">
        {staff.map((person) => (
          <label key={person.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="advisorIds"
              value={person.id}
              defaultChecked={selectedIds.has(person.id)}
              className="mt-1"
            />
            <span>
              {person.name ?? person.email}{" "}
              <span className="text-muted-foreground">({person.role})</span>
            </span>
          </label>
        ))}
      </div>
    );
  }

  function studentCheckboxList(selectedIds: Set<string>) {
    return (
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border p-3">
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students in session</p>
        ) : (
          students.map((student) => (
            <label
              key={student.id}
              className="flex items-start gap-2 text-sm"
            >
              <input
                type="checkbox"
                name="studentIds"
                value={student.id}
                defaultChecked={selectedIds.has(student.id)}
                className="mt-1"
              />
              <span>
                {student.firstName} {student.lastName}
                {student.team ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {student.team.name}
                  </span>
                ) : null}
              </span>
            </label>
          ))
        )}
      </div>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Clubs</CardTitle>
          <p className="text-sm text-muted-foreground">
            Electives with 1–3 advisors. Students may join more than one club.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setImportOpen(true)}
              disabled={!sessionId}
            >
              <Upload className="size-4" aria-hidden />
              Import CSV
            </Button>
            <Button
              type="button"
              className="min-h-11"
              onClick={() => setCreateOpen(true)}
              disabled={!sessionId}
            >
              <Plus className="size-4" aria-hidden />
              Add club
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="club-session">Session</Label>
          <select
            id="club-session"
            className="min-h-11 w-full rounded-xl border bg-background px-3"
            value={sessionId}
            onChange={(event) => void loadForSession(event.target.value)}
          >
            {sessions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>

        {!selectedSession ? (
          <p className="text-sm text-muted-foreground">No session available.</p>
        ) : clubs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clubs yet for this session.
          </p>
        ) : (
          <ul className="space-y-2">
            {clubs.map((club) => {
              const open = expandedId === club.id;
              return (
                <li key={club.id} className="rounded-xl border">
                  <div className="flex flex-wrap items-center gap-2 p-3">
                    <button
                      type="button"
                      className="flex min-h-10 flex-1 items-center gap-2 text-left"
                      onClick={() => setExpandedId(open ? null : club.id)}
                    >
                      {open ? (
                        <ChevronDown className="size-4 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" />
                      )}
                      <span className="font-medium">{club.name}</span>
                      <span className="text-sm text-muted-foreground">
                        · {club.advisors.length} advisors ·{" "}
                        {club._count.memberships} students
                      </span>
                    </button>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9"
                          onClick={() => setEditClub(club)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 text-destructive"
                          onClick={() => void deleteClub(club)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {open && (
                    <div className="space-y-3 border-t bg-muted/20 px-4 py-3 text-sm">
                      <div>
                        <p className="mb-1 font-medium">Advisors</p>
                        <ul className="text-muted-foreground">
                          {club.advisors.map((advisor) => (
                            <li key={advisor.id}>
                              {advisor.name ?? advisor.email}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 flex items-center gap-2 font-medium">
                          <Users className="size-4" aria-hidden />
                          Members
                        </p>
                        {club.students.length === 0 ? (
                          <p className="text-muted-foreground">No students yet</p>
                        ) : (
                          <ul className="space-y-1 text-muted-foreground">
                            {club.students.map((student) => (
                              <li key={student.id}>
                                {student.firstName} {student.lastName}
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
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create club</DialogTitle>
            <DialogDescription>
              Assign 1–3 advisors and optionally add students. Students can
              belong to multiple clubs.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void createClub(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="club-name">Name</Label>
              <Input
                id="club-name"
                name="name"
                required
                className="min-h-11"
                placeholder="Robotics"
              />
            </div>
            <div className="space-y-2">
              <Label>Advisors (1–3)</Label>
              {advisorCheckboxList(new Set())}
            </div>
            <div className="space-y-2">
              <Label>Students</Label>
              {studentCheckboxList(new Set())}
            </div>
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Saving..." : "Create club"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editClub}
        onOpenChange={(open) => {
          if (!open) setEditClub(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit club</DialogTitle>
            <DialogDescription>
              Update advisors or membership. Leaving a club does not remove the
              student from other clubs.
            </DialogDescription>
          </DialogHeader>
          {editClub && (
            <form onSubmit={(event) => void saveEdit(event)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="club-edit-name">Name</Label>
                <Input
                  id="club-edit-name"
                  name="name"
                  required
                  className="min-h-11"
                  defaultValue={editClub.name}
                />
              </div>
              <div className="space-y-2">
                <Label>Advisors (1–3)</Label>
                {advisorCheckboxList(
                  new Set(editClub.advisors.map((row) => row.id)),
                )}
              </div>
              <div className="space-y-2">
                <Label>Students</Label>
                {studentCheckboxList(
                  new Set(editClub.students.map((row) => row.id)),
                )}
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

      <ImportClubsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        sessionId={sessionId}
        onImported={() => void loadForSession(sessionId)}
      />
    </Card>
  );
}
