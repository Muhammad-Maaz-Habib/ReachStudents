"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Search } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { MedicalFlagBadge } from "@/components/roster/medical-flag-badge";
import { OfflineBanner } from "@/components/checkin/offline-banner";
import {
  QuickCreateActivityDialog,
  type CreatedActivity,
} from "@/components/checkin/quick-create-activity-dialog";
import { StatusBadge } from "@/components/design-system/status-badge";
import { useCheckInActions } from "@/hooks/use-checkin";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type StudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  team: { id: string; name: string; color: string | null } | null;
  medicalProfile: { allergies: string | null } | null;
};

type ActivityOption = {
  id: string;
  name: string;
  location: string | null;
  startTime: string;
  endTime: string;
  teamId: string | null;
  color: string | null;
};

type OpenCheckIn = {
  id: string;
  studentId: string;
  activityId: string | null;
  checkedInAt: string;
};

type TeamOption = { id: string; name: string };

type RollCallFlowProps = {
  staffId: string;
  sessionName: string;
  students: StudentRow[];
  activities: ActivityOption[];
  teams: TeamOption[];
  openCheckIns: OpenCheckIn[];
  canCreateActivity: boolean;
  initialActivityId?: string | null;
};

export function RollCallFlow({
  staffId,
  sessionName,
  students,
  activities: initialActivities,
  teams,
  openCheckIns: initialOpen,
  canCreateActivity,
  initialActivityId = null,
}: RollCallFlowProps) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities);
  const [activityId, setActivityId] = useState<string | null>(
    initialActivityId &&
      initialActivities.some((activity) => activity.id === initialActivityId)
      ? initialActivityId
      : null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState(
    () =>
      new Map(
        initialOpen
          .filter((checkIn) => checkIn.activityId)
          .map((checkIn) => [checkIn.studentId, checkIn]),
      ),
  );

  const { isOnline, pendingCount, isSyncing, performCheckIn, syncPending } =
    useCheckInActions(() => router.refresh());

  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  useEffect(() => {
    setOpenMap(
      new Map(
        initialOpen
          .filter((checkIn) =>
            activityId ? checkIn.activityId === activityId : false,
          )
          .map((checkIn) => [checkIn.studentId, checkIn]),
      ),
    );
  }, [initialOpen, activityId]);

  const activeActivity = activities.find((activity) => activity.id === activityId);

  const eligibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = students;
    if (activeActivity?.teamId) {
      list = list.filter((student) => student.team?.id === activeActivity.teamId);
    }
    if (!q) return list;
    return list.filter((student) =>
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(q),
    );
  }, [students, activeActivity?.teamId, query]);

  const checkedInCount = eligibleStudents.filter((student) =>
    openMap.has(student.id),
  ).length;

  function handleCreated(activity: CreatedActivity) {
    const next: ActivityOption = {
      id: activity.id,
      name: activity.name,
      location: activity.location,
      startTime: activity.startTime,
      endTime: activity.endTime,
      teamId: activity.teamId,
      color: activity.color,
    };
    setActivities((current) => {
      if (current.some((row) => row.id === next.id)) return current;
      return [next, ...current];
    });
    setActivityId(next.id);
    setOpenMap(new Map());
    router.refresh();
  }

  async function toggleStudent(student: StudentRow) {
    if (!activityId || busyStudentId) return;

    const isIn = openMap.has(student.id);
    setBusyStudentId(student.id);
    const result = await performCheckIn({
      studentId: student.id,
      type: isIn ? "check_out" : "check_in",
      staffId,
      activityId,
    });
    setBusyStudentId(null);

    if (result.offline || !("error" in result && result.error)) {
      setOpenMap((current) => {
        const next = new Map(current);
        if (isIn) {
          next.delete(student.id);
        } else {
          next.set(student.id, {
            id: `pending-${Date.now()}`,
            studentId: student.id,
            activityId,
            checkedInAt: new Date().toISOString(),
          });
        }
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <OfflineBanner
        isOnline={isOnline}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSync={() => void syncPending()}
      />

      <div className="flex items-center gap-3">
        <Link
          href="/checkin"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "size-11 shrink-0 rounded-xl",
          )}
          aria-label="Back to check-in"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <PageHeader
            title="Activity roll call"
            description={`${sessionName} · create or pick an activity, then tap students present`}
            action={
              canCreateActivity ? (
                <QuickCreateActivityDialog
                  open={createOpen}
                  onOpenChange={setCreateOpen}
                  teams={teams}
                  existingColors={activities.map((activity) => activity.color)}
                  onCreated={handleCreated}
                  showTrigger
                  triggerLabel="New activity"
                />
              ) : undefined
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="roll-call-activity" className="text-sm font-medium">
          Activity
        </label>
        <select
          id="roll-call-activity"
          className="min-h-12 w-full rounded-xl border bg-background px-3 text-base"
          value={activityId ?? ""}
          onChange={(event) => setActivityId(event.target.value || null)}
        >
          <option value="">Select an activity…</option>
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.name}
              {activity.location ? ` · ${activity.location}` : ""} ·{" "}
              {new Date(activity.startTime).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </option>
          ))}
        </select>
        {canCreateActivity && activities.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No nearby activities — use <strong>New activity</strong> to start one
            now (it also appears on /schedule).
          </p>
        )}
      </div>

      {activeActivity && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" aria-hidden />
              <span>
                <strong>{activeActivity.name}</strong>
                {activeActivity.teamId
                  ? ` · ${teams.find((team) => team.id === activeActivity.teamId)?.name ?? "Team"}`
                  : " · All eligible students"}
              </span>
            </div>
            <StatusBadge
              status="info"
              label={`${checkedInCount} / ${eligibleStudents.length} present`}
            />
          </div>

          <div className="relative" role="search">
            <label htmlFor="roll-call-search" className="sr-only">
              Find a student
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="roll-call-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a student..."
              className="min-h-12 pl-9 text-base"
              type="search"
              autoComplete="off"
            />
          </div>

          <ul className="grid gap-2" aria-label="Roll call roster">
            {eligibleStudents.map((student) => {
              const checkedIn = openMap.has(student.id);
              const busy = busyStudentId === student.id;

              return (
                <li key={student.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                      checkedIn
                        ? "border-emerald-600/40 bg-emerald-500/10"
                        : "hover:bg-muted/50",
                      busy && "opacity-60",
                    )}
                    onClick={() => void toggleStudent(student)}
                    aria-pressed={checkedIn}
                    aria-label={`${checkedIn ? "Check out" : "Check in"} ${student.firstName} ${student.lastName}`}
                  >
                    <Avatar className="size-10 rounded-xl">
                      <AvatarFallback className="rounded-xl text-sm">
                        {student.firstName.charAt(0)}
                        {student.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {student.team?.name ?? "Unassigned"}
                        {student.grade ? ` · Grade ${student.grade}` : ""}
                      </p>
                      <div className="mt-1">
                        <MedicalFlagBadge student={student} />
                      </div>
                    </div>
                    <StatusBadge
                      status={checkedIn ? "success" : "neutral"}
                      label={checkedIn ? "Present" : "Tap in"}
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          {eligibleStudents.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No eligible students for this activity
              {activeActivity.teamId ? " team" : ""}.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/checkin/whos-here?activityId=${activeActivity.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              View on Who&apos;s here
            </Link>
            <Link
              href="/schedule"
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              Open schedule
            </Link>
          </div>
        </>
      )}

      {!activeActivity && canCreateActivity && (
        <QuickCreateActivityDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          teams={teams}
          existingColors={activities.map((activity) => activity.color)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
