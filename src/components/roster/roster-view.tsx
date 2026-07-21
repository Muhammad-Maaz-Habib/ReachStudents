"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Search, Upload, Users } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { MedicalFlagBadge } from "@/components/roster/medical-flag-badge";
import { StudentFormDialog } from "@/components/roster/student-form-dialog";
import { ImportRosterDialog } from "@/components/roster/import-roster-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { StudentWithRelations } from "@/lib/students";

type TeamOption = {
  id: string;
  name: string;
  color: string | null;
};

type StaffOption = {
  id: string;
  name: string | null;
};

type RosterViewProps = {
  sessionName: string;
  teams: TeamOption[];
  staffUsers: StaffOption[];
  grades: string[];
  students: StudentWithRelations[];
  canEdit: boolean;
  initialQuery: string;
  initialTeamId?: string;
  initialGrade?: string;
  initialHasAllergy?: string;
  initialStaffId?: string;
  initialView?: "students" | "teams";
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function RosterView({
  sessionName,
  teams,
  staffUsers,
  grades,
  students,
  canEdit,
  initialQuery,
  initialTeamId,
  initialGrade,
  initialHasAllergy,
  initialStaffId,
  initialView = "students",
}: RosterViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const showTeams = initialView === "teams" && !initialTeamId;

  function updateFilters(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });

    startTransition(() => {
      router.push(`/roster?${params.toString()}`);
    });
  }

  const teamCounts = new Map<string, number>();
  let unassignedCount = 0;
  for (const student of students) {
    const teamId = student.team?.id;
    if (!teamId) {
      unassignedCount += 1;
      continue;
    }
    teamCounts.set(teamId, (teamCounts.get(teamId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={showTeams ? "Teams" : "Roster"}
        description={
          showTeams
            ? `${sessionName} · ${teams.length} team${teams.length === 1 ? "" : "s"}`
            : `${sessionName} · ${students.length} student${students.length === 1 ? "" : "s"}`
        }
        action={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="size-4" aria-hidden />
                Import CSV
              </Button>
              <Button className="min-h-11" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Add student
              </Button>
            </div>
          ) : undefined
        }
      />

      {showTeams ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const count = teamCounts.get(team.id) ?? 0;
            return (
              <Link
                key={team.id}
                href={`/roster?teamId=${team.id}`}
                className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full rounded-2xl transition-colors hover:bg-muted/40 hover:ring-1 hover:ring-foreground/10">
                  <CardContent className="flex items-center gap-4 p-5">
                    <span
                      className="size-10 shrink-0 rounded-xl"
                      style={{ backgroundColor: team.color ?? "#9CA3AF" }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{team.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {count} student{count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Users className="size-4 text-muted-foreground" aria-hidden />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {unassignedCount > 0 && (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="flex items-center gap-4 p-5">
                <span
                  className="size-10 shrink-0 rounded-xl bg-muted"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Unassigned</p>
                  <p className="text-sm text-muted-foreground">
                    {unassignedCount} student
                    {unassignedCount === 1 ? "" : "s"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {teams.length === 0 && (
            <EmptyState
              icon={Users}
              title="No teams yet"
              description="Create teams in Settings to organize your roster."
            />
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
            <form
              className="relative"
              onSubmit={(event) => {
                event.preventDefault();
                updateFilters({ q: query || undefined, view: undefined });
              }}
            >
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search students or guardians..."
                className="min-h-11 pl-9"
              />
            </form>

            <Select
              value={initialTeamId ?? "all"}
              onValueChange={(value) =>
                updateFilters({
                  teamId: !value || value === "all" ? undefined : value,
                  view: undefined,
                })
              }
            >
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={initialGrade ?? "all"}
              onValueChange={(value) =>
                updateFilters({
                  grade: !value || value === "all" ? undefined : value,
                  view: undefined,
                })
              }
            >
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    Grade {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={initialHasAllergy ?? "all"}
              onValueChange={(value) =>
                updateFilters({
                  hasAllergy: !value || value === "all" ? undefined : value,
                  view: undefined,
                })
              }
            >
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="Medical flags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All medical flags</SelectItem>
                <SelectItem value="true">Has allergies</SelectItem>
                <SelectItem value="false">No allergies</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={initialStaffId ?? "all"}
              onValueChange={(value) =>
                updateFilters({
                  staffId: !value || value === "all" ? undefined : value,
                  view: undefined,
                })
              }
            >
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff assignments</SelectItem>
                {staffUsers.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name ?? "Staff"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isPending && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Updating roster...
            </p>
          )}

          {students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students match"
              description={
                canEdit
                  ? "Add a student manually or import a CSV to get started."
                  : "No students are visible with the current filters."
              }
              action={
                canEdit ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button className="min-h-11" onClick={() => setAddOpen(true)}>
                      Add student
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      onClick={() => setImportOpen(true)}
                    >
                      Import CSV
                    </Button>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3">
              {students.map((student) => (
                <Link key={student.id} href={`/roster/${student.id}`}>
                  <Card className="rounded-2xl transition-colors hover:bg-muted/30">
                    <CardContent className="flex items-center gap-4 p-4">
                      <Avatar className="size-12 rounded-2xl">
                        <AvatarFallback className="rounded-2xl bg-secondary text-secondary-foreground">
                          {getInitials(student.firstName, student.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {student.firstName} {student.lastName}
                          </p>
                          {student.grade && (
                            <Badge variant="secondary">
                              Grade {student.grade}
                            </Badge>
                          )}
                          <MedicalFlagBadge student={student} />
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {student.team?.name ?? "Unassigned"}
                          {student.guardianName
                            ? ` · ${student.guardianName}`
                            : ""}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {canEdit && (
        <>
          <StudentFormDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            teams={teams}
            title="Add student"
            description="Enter roster details, medical flags, and guardian contact."
            submitLabel="Add student"
          />
          <ImportRosterDialog open={importOpen} onOpenChange={setImportOpen} />
        </>
      )}
    </div>
  );
}
