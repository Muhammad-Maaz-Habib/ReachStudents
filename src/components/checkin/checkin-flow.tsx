"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, LogIn, LogOut, Users, ClipboardCheck, Plus, MapPinned } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  activityOptionLabel,
  formatActivityTimeRange,
} from "@/lib/validations/activity";

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
  color?: string | null;
  isOpenEnded?: boolean;
};

type OpenCheckIn = {
  id: string;
  studentId: string;
  activityId: string | null;
  checkedInAt: string;
};

type MissingAlert = {
  activityId: string;
  activityName: string;
  students: { firstName: string; lastName: string }[];
};

type TeamOption = { id: string; name: string };

type CheckInFlowProps = {
  staffId: string;
  sessionName: string;
  students: StudentRow[];
  activities: ActivityOption[];
  teams: TeamOption[];
  openCheckIns: OpenCheckIn[];
  checkedInCount: number;
  canCreateActivity: boolean;
};

function scopeKey(studentId: string, activityId: string | null) {
  return `${studentId}:${activityId ?? "general"}`;
}

export function CheckInFlow({
  staffId,
  sessionName,
  students,
  activities: initialActivities,
  teams,
  openCheckIns: initialOpen,
  checkedInCount,
  canCreateActivity,
}: CheckInFlowProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [activities, setActivities] = useState(initialActivities);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [missingAlerts, setMissingAlerts] = useState<MissingAlert[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [openMap, setOpenMap] = useState(
    () =>
      new Map(
        initialOpen.map((checkIn) => [
          scopeKey(checkIn.studentId, checkIn.activityId),
          checkIn,
        ]),
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
        initialOpen.map((checkIn) => [
          scopeKey(checkIn.studentId, checkIn.activityId),
          checkIn,
        ]),
      ),
    );
  }, [initialOpen]);

  function handleActivityCreated(activity: CreatedActivity) {
    setActivities((current) => {
      if (current.some((row) => row.id === activity.id)) return current;
      return [
        {
          id: activity.id,
          name: activity.name,
          location: activity.location,
          startTime: activity.startTime,
          endTime: activity.endTime,
          color: activity.color,
          isOpenEnded: activity.isOpenEnded ?? true,
        },
        ...current,
      ];
    });
    setActivityId(activity.id);
    router.refresh();
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      async function loadAlerts() {
        const response = await fetch("/api/alerts/missing");
        if (!response.ok) return;
        const data = await response.json();
        setMissingAlerts(data.alerts ?? []);
        void fetch("/api/alerts/missing/notify", { method: "POST" });
      }
      void loadAlerts();
    }, 0);

    const interval = window.setInterval(() => {
      void fetch("/api/alerts/missing")
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data) setMissingAlerts(data.alerts ?? []);
        });
    }, 60_000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(q),
    );
  }, [deferredQuery, students]);

  const activeActivity = activities.find((activity) => activity.id === activityId);

  async function toggleStudent(student: StudentRow) {
    if (busyStudentId) return;

    const key = scopeKey(student.id, activityId);
    const isIn = openMap.has(key);
    const type = isIn ? "check_out" : "check_in";

    setBusyStudentId(student.id);
    setSelectedId(student.id);
    setStatusMessage(
      `${type === "check_in" ? "Checking in" : "Checking out"} ${student.firstName} ${student.lastName}`,
    );

    const result = await performCheckIn({
      studentId: student.id,
      type,
      staffId,
      activityId,
    });
    setBusyStudentId(null);

    if (result.offline || !("error" in result && result.error)) {
      setOpenMap((current) => {
        const next = new Map(current);
        if (type === "check_in") {
          next.set(key, {
            id: `pending-${Date.now()}`,
            studentId: student.id,
            activityId,
            checkedInAt: new Date().toISOString(),
          });
        } else {
          next.delete(key);
        }
        return next;
      });
      setStatusMessage(
        `${student.firstName} ${student.lastName} ${type === "check_in" ? "checked in" : "checked out"}`,
      );
    }
  }

  const missingTotal = missingAlerts.reduce(
    (sum, alert) => sum + alert.students.length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      <OfflineBanner
        isOnline={isOnline}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSync={() => void syncPending()}
      />

      {missingTotal > 0 && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-destructive">
              {missingTotal} student{missingTotal === 1 ? "" : "s"} missing from
              scheduled activities
            </p>
            {missingAlerts.slice(0, 2).map((alert) => (
              <p key={alert.activityId} className="text-muted-foreground">
                {alert.activityName}:{" "}
                {alert.students
                  .map((s) => `${s.firstName} ${s.lastName}`)
                  .join(", ")}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <PageHeader
        title="Check-In"
        description={`${sessionName} · ${checkedInCount} checked in now`}
        action={
          <div className="flex flex-wrap gap-2">
            {canCreateActivity && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                New activity
              </Button>
            )}
            <Link
              href="/checkin/roll-call"
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              <ClipboardCheck className="size-4" aria-hidden />
              Activity roll call
            </Link>
            <Link
              href="/checkin/whos-here"
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              <Users className="size-4" aria-hidden />
              Who&apos;s here
            </Link>
            <Link
              href="/checkin/map"
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              <MapPinned className="size-4" aria-hidden />
              Campus map
            </Link>
            <StatusBadge
              status={isOnline ? "success" : "warning"}
              label={isOnline ? "Online" : "Offline"}
            />
          </div>
        }
      />

      {canCreateActivity && (
        <QuickCreateActivityDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          teams={teams}
          existingColors={activities.map((activity) => activity.color)}
          onCreated={handleActivityCreated}
        />
      )}
      <Select
        value={activityId ?? "general"}
        onValueChange={(value) =>
          setActivityId(value === "general" ? null : value)
        }
      >
        <SelectTrigger
          className="min-h-12 w-full text-base"
          aria-label="Check-in location"
        >
          <SelectValue placeholder="Check-in location">
            {(value) => {
              if (!value || value === "general") return "General campus";
              const activity = activities.find((row) => row.id === value);
              return activity
                ? activityOptionLabel(activity)
                : "Check-in location";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="general" label="General campus">
            General campus
          </SelectItem>
          {activities.map((activity) => {
            const label = activityOptionLabel(activity);
            return (
              <SelectItem key={activity.id} value={activity.id} label={label}>
                {label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {activeActivity && (
        <p className="text-sm text-muted-foreground">
          Activity check-in: {activeActivity.name} (
          {formatActivityTimeRange(activeActivity)})
        </p>
      )}

      <div className="relative" role="search">
        <label htmlFor="checkin-student-search" className="sr-only">
          Find a student
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="checkin-student-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a student..."
          className="min-h-12 pl-9 text-base"
          autoComplete="off"
          type="search"
        />
      </div>

      <ul className="grid gap-2" aria-label="Student roster">
        {filtered.map((student) => {
          const checkedIn = openMap.has(scopeKey(student.id, activityId));
          const selected = selectedId === student.id;
          const busy = busyStudentId === student.id;

          return (
            <li key={student.id}>
              <div
                className={cn(
                  "rounded-2xl border transition-colors",
                  selected ? "border-primary bg-primary/5" : "bg-background",
                  checkedIn && "border-emerald-600/40 bg-emerald-500/5",
                )}
              >
                <div className="flex min-h-14 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left"
                    onClick={() =>
                      setSelectedId((current) =>
                        current === student.id ? null : student.id,
                      )
                    }
                    aria-pressed={selected}
                    aria-label={`${student.firstName} ${student.lastName}, show medical flags`}
                  >
                    <Avatar className="size-10 shrink-0 rounded-xl">
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
                      </p>
                    </div>
                  </button>

                  <StatusBadge
                    status={checkedIn ? "success" : "neutral"}
                    label={checkedIn ? "In" : "Out"}
                    className="hidden shrink-0 sm:inline-flex"
                  />

                  <Button
                    type="button"
                    size="sm"
                    variant={checkedIn ? "secondary" : "default"}
                    className="min-h-11 shrink-0 gap-1.5 px-3 text-sm font-semibold"
                    disabled={busy || !!busyStudentId}
                    onClick={() => void toggleStudent(student)}
                    aria-label={
                      checkedIn
                        ? `Check out ${student.firstName} ${student.lastName}`
                        : `Check in ${student.firstName} ${student.lastName}`
                    }
                  >
                    {checkedIn ? (
                      <>
                        <LogOut className="size-4" aria-hidden />
                        Check out
                      </>
                    ) : (
                      <>
                        <LogIn className="size-4" aria-hidden />
                        Check in
                      </>
                    )}
                  </Button>
                </div>

                {selected && (
                  <div className="border-t px-4 py-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Medical flags
                    </p>
                    <MedicalFlagBadge student={student} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
