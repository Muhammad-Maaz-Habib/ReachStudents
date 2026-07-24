"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { MedicalFlagBadge } from "@/components/roster/medical-flag-badge";
import { PageHeader } from "@/components/design-system/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type RollCallStudent = {
  id: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  team: { id: string; name: string; color: string | null } | null;
  mentorGroup?: { id: string; name: string } | null;
  medicalProfile: {
    allergies: string | null;
    medications: string | null;
    conditions: string | null;
  } | null;
};

type RollCallViewProps = {
  sessionName: string;
  initialTeamId?: string;
  initialMentorGroupId?: string;
  teams: { id: string; name: string; color: string | null }[];
  mentorGroups?: { id: string; name: string }[];
  initialData: {
    totalExpected: number;
    presentCount: number;
    missingCount: number;
    onLeaveCount?: number;
    present: {
      student: RollCallStudent;
      checkedInAt: string;
      activity: { name: string; location: string | null } | null;
      onApprovedLeave?: boolean;
    }[];
    missing: RollCallStudent[];
    onLeave?: RollCallStudent[];
  };
};
export function RollCallView({
  sessionName,
  initialTeamId,
  initialMentorGroupId,
  teams,
  mentorGroups = [],
  initialData,
}: RollCallViewProps) {
  const [teamId, setTeamId] = useState(initialTeamId ?? "all");
  const [mentorGroupId, setMentorGroupId] = useState(
    initialMentorGroupId ?? "all",
  );
  const [data, setData] = useState(initialData);

  useEffect(() => {
    async function refresh() {
      const params = new URLSearchParams();
      if (teamId && teamId !== "all") params.set("teamId", teamId);
      if (mentorGroupId && mentorGroupId !== "all") {
        params.set("mentorGroupId", mentorGroupId);
      }
      const response = await fetch(`/api/emergency/roll-call?${params.toString()}`);
      if (!response.ok) return;
      setData(await response.json());
    }
    void refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [teamId, mentorGroupId]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Emergency roll-call"
        description={`${sessionName} · account for every student`}
        action={
          <Link
            href="/checkin/whos-here"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
          >
            Standard view
          </Link>
        }
      />

      <div
        className={cn(
          "rounded-2xl border p-4 text-center",
          data.missingCount > 0
            ? "border-destructive/50 bg-destructive/10"
            : "border-green-600/30 bg-green-50 dark:bg-green-950/20",
        )}
      >
        <p className="text-3xl font-bold tabular-nums">
          {data.presentCount} / {data.totalExpected}
        </p>
        <p className="text-sm font-medium">
          {data.missingCount > 0
            ? `${data.missingCount} student${data.missingCount === 1 ? "" : "s"} NOT accounted for`
            : (data.onLeaveCount ?? 0) > 0
              ? `All accounted for (${data.onLeaveCount} on approved leave)`
              : "All students accounted for"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          value={teamId}
          onValueChange={(value) => setTeamId(value ?? "all")}
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
          value={mentorGroupId}
          onValueChange={(value) => setMentorGroupId(value ?? "all")}
        >
          <SelectTrigger className="min-h-11 w-full">
            <SelectValue placeholder="All mentor groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All mentor groups</SelectItem>
            {mentorGroups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.missingCount > 0 && (
        <Card className="rounded-2xl border-destructive/40">
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" aria-hidden />
              <p className="font-semibold">Missing — immediate follow-up</p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.missing.map((student) => (
                <li
                  key={student.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {student.team?.name ?? "Unassigned"}
                      {student.mentorGroup
                        ? ` · ${student.mentorGroup.name}`
                        : ""}
                    </p>
                  </div>
                  <MedicalFlagBadge student={student} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(data.onLeave?.length ?? 0) > 0 && (
        <Card className="rounded-2xl border-sky-500/30">
          <CardContent className="space-y-2 pt-6">
            <p className="font-semibold text-sky-800 dark:text-sky-300">
              On approved leave ({data.onLeaveCount ?? data.onLeave?.length})
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.onLeave?.map((student) => (
                <li
                  key={student.id}
                  className="rounded-xl border bg-muted/20 px-4 py-3 text-sm"
                >
                  <p className="font-medium">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-muted-foreground">
                    {student.team?.name ?? "Unassigned"}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <ShieldAlert className="size-5" aria-hidden />
            <p className="font-semibold">Accounted for ({data.presentCount})</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.present.map((row) => (
              <li
                key={row.student.id}
                className="rounded-xl border bg-muted/20 px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {row.student.firstName} {row.student.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.student.team?.name}
                  {row.student.mentorGroup
                    ? ` · ${row.student.mentorGroup.name}`
                    : ""}{" "}
                  · In {new Date(row.checkedInAt).toLocaleTimeString()}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Link
        href="/emergency"
        className={cn(buttonVariants({ variant: "destructive" }), "min-h-11 w-full")}
      >
        Open emergency protocols
      </Link>
    </div>
  );
}
