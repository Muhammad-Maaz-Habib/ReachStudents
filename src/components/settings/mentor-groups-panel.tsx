"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Trash2, Users } from "lucide-react";
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
  mentorGroupId: string | null;
  team: { name: string } | null;
};

export type MentorGroupSummary = {
  id: string;
  sessionId: string;
  name: string;
  mentor: StaffOption;
  students: {
    id: string;
    firstName: string;
    lastName: string;
    teamId: string | null;
  }[];
  _count: { students: number };
};

type MentorGroupsPanelProps = {
  canEdit: boolean;
  sessions: SessionSummary[];
  initialSessionId: string | null;
  initialGroups: MentorGroupSummary[];
  staffOptions: StaffOption[];
  studentOptions: StudentOption[];
};

export function MentorGroupsPanel({
  canEdit,
  sessions,
  initialSessionId,
  initialGroups,
  staffOptions,
  studentOptions: initialStudents,
}: MentorGroupsPanelProps) {
  const router = useRouter();
  const activeFallback =
    sessions.find((row) => row.isActive)?.id ?? sessions[0]?.id ?? "";
  const [sessionId, setSessionId] = useState(
    initialSessionId ?? activeFallback,
  );
  const [groups, setGroups] = useState(initialGroups);
  const [students, setStudents] = useState(initialStudents);
  const [staff] = useState(staffOptions);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<MentorGroupSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((row) => row.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  async function loadForSession(nextSessionId: string) {
    const response = await fetch(
      `/api/settings/mentor-groups?sessionId=${encodeURIComponent(nextSessionId)}`,
    );
    if (!response.ok) {
      toast.error("Could not load mentor groups");
      return;
    }
    const data = await response.json();
    setGroups(data.groups ?? []);
    setStudents(data.studentOptions ?? []);
    setSessionId(nextSessionId);
    setExpandedId(null);
  }

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const mentorId = String(form.get("mentorId") ?? "");
    const studentIds = form.getAll("studentIds").map(String);

    if (!name || !mentorId) {
      toast.error("Name and mentor are required");
      return;
    }

    setIsSaving(true);
    const response = await fetch("/api/settings/mentor-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        name,
        mentorId,
        studentIds,
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not create mentor group");
      return;
    }

    toast.success("Mentor group created");
    setCreateOpen(false);
    await loadForSession(sessionId);
    router.refresh();
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editGroup) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const mentorId = String(form.get("mentorId") ?? "");
    const studentIds = form.getAll("studentIds").map(String);

    setIsSaving(true);
    const response = await fetch(`/api/settings/mentor-groups/${editGroup.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mentorId, studentIds }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not update mentor group");
      return;
    }

    toast.success("Mentor group updated");
    setEditGroup(null);
    await loadForSession(sessionId);
    router.refresh();
  }

  async function deleteGroup(group: MentorGroupSummary) {
    if (
      !window.confirm(
        `Delete mentor group “${group.name}”? Students stay on roster and keep their academic team; they are only unassigned from this mentor group.`,
      )
    ) {
      return;
    }

    const response = await fetch(`/api/settings/mentor-groups/${group.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Could not delete mentor group");
      return;
    }
    toast.success("Mentor group deleted");
    await loadForSession(sessionId);
    router.refresh();
  }

  function studentCheckboxList(
    selectedIds: Set<string>,
    name = "studentIds",
  ) {
    return (
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border p-3">
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students in session</p>
        ) : (
          students.map((student) => {
            const assignedElsewhere =
              student.mentorGroupId &&
              !selectedIds.has(student.id) &&
              student.mentorGroupId !== editGroup?.id;
            return (
              <label
                key={student.id}
                className="flex items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name={name}
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
                  {assignedElsewhere ? (
                    <span className="block text-xs text-amber-700">
                      Currently in another mentor group — selecting moves them
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Mentor groups</CardTitle>
          <p className="text-sm text-muted-foreground">
            Day-to-day cohorts (~8–10 students) with one assigned mentor.
            Independent from academic teams/programs.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            className="min-h-11"
            onClick={() => setCreateOpen(true)}
            disabled={!sessionId}
          >
            <Plus className="size-4" aria-hidden />
            Add group
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mentor-session">Session</Label>
          <select
            id="mentor-session"
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
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mentor groups yet for this session.
          </p>
        ) : (
          <ul className="space-y-2">
            {groups.map((group) => {
              const open = expandedId === group.id;
              return (
                <li key={group.id} className="rounded-xl border">
                  <div className="flex flex-wrap items-center gap-2 p-3">
                    <button
                      type="button"
                      className="flex min-h-10 flex-1 items-center gap-2 text-left"
                      onClick={() =>
                        setExpandedId(open ? null : group.id)
                      }
                    >
                      {open ? (
                        <ChevronDown className="size-4 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" />
                      )}
                      <span className="font-medium">{group.name}</span>
                      <span className="text-sm text-muted-foreground">
                        · {group.mentor.name ?? group.mentor.email} ·{" "}
                        {group._count.students} students
                      </span>
                    </button>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9"
                          onClick={() => setEditGroup(group)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 text-destructive"
                          onClick={() => void deleteGroup(group)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {open && (
                    <div className="border-t bg-muted/20 px-4 py-3 text-sm">
                      <p className="mb-2 flex items-center gap-2 font-medium">
                        <Users className="size-4" aria-hidden />
                        Roster
                      </p>
                      {group.students.length === 0 ? (
                        <p className="text-muted-foreground">No students yet</p>
                      ) : (
                        <ul className="space-y-1 text-muted-foreground">
                          {group.students.map((student) => (
                            <li key={student.id}>
                              {student.firstName} {student.lastName}
                            </li>
                          ))}
                        </ul>
                      )}
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
            <DialogTitle>Create mentor group</DialogTitle>
            <DialogDescription>
              Assign one mentor and optionally add students. Academic team
              assignments are unchanged.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void createGroup(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mg-name">Name</Label>
              <Input
                id="mg-name"
                name="name"
                required
                className="min-h-11"
                placeholder="Mentor Group A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mg-mentor">Mentor</Label>
              <select
                id="mg-mentor"
                name="mentorId"
                required
                className="min-h-11 w-full rounded-xl border bg-background px-3"
                defaultValue=""
              >
                <option value="" disabled>
                  Select staff…
                </option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name ?? person.email} ({person.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Students</Label>
              {studentCheckboxList(new Set())}
            </div>
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Saving..." : "Create group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editGroup}
        onOpenChange={(open) => {
          if (!open) setEditGroup(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit mentor group</DialogTitle>
            <DialogDescription>
              Update mentor or roster. Moving a student here removes them from
              any other mentor group.
            </DialogDescription>
          </DialogHeader>
          {editGroup && (
            <form onSubmit={(event) => void saveEdit(event)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mg-edit-name">Name</Label>
                <Input
                  id="mg-edit-name"
                  name="name"
                  required
                  className="min-h-11"
                  defaultValue={editGroup.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mg-edit-mentor">Mentor</Label>
                <select
                  id="mg-edit-mentor"
                  name="mentorId"
                  required
                  className="min-h-11 w-full rounded-xl border bg-background px-3"
                  defaultValue={editGroup.mentor.id}
                >
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name ?? person.email} ({person.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Students</Label>
                {studentCheckboxList(
                  new Set(editGroup.students.map((row) => row.id)),
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
    </Card>
  );
}
