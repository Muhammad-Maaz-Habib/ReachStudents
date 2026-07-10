"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, LogIn, LogOut, Users } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { MedicalFlagBadge } from "@/components/roster/medical-flag-badge";
import { OfflineBanner } from "@/components/checkin/offline-banner";
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

type CheckInFlowProps = {
  staffId: string;
  sessionName: string;
  students: StudentRow[];
  activities: ActivityOption[];
  openCheckIns: OpenCheckIn[];
  checkedInCount: number;
};

function scopeKey(studentId: string, activityId: string | null) {
  return `${studentId}:${activityId ?? "general"}`;
}

export function CheckInFlow({
  staffId,
  sessionName,
  students,
  activities,
  openCheckIns: initialOpen,
  checkedInCount,
}: CheckInFlowProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
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

  const selected = students.find((student) => student.id === selectedId);
  const selectedScope = selectedId
    ? scopeKey(selectedId, activityId)
    : undefined;
  const selectedOpen = selectedScope ? openMap.get(selectedScope) : undefined;
  const isCheckedIn = !!selectedOpen;

  const activeActivity = activities.find((activity) => activity.id === activityId);

  async function handleToggle() {
    if (!selected) return;

    const type = isCheckedIn ? "check_out" : "check_in";
    const result = await performCheckIn({
      studentId: selected.id,
      type,
      staffId,
      activityId,
    });

    if (result.offline || !("error" in result && result.error)) {
      const next = new Map(openMap);
      const key = scopeKey(selected.id, activityId);
      if (type === "check_in") {
        next.set(key, {
          id: `pending-${Date.now()}`,
          studentId: selected.id,
          activityId,
          checkedInAt: new Date().toISOString(),
        });
      } else {
        next.delete(key);
      }
      setOpenMap(next);
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
            <Link
              href="/checkin/whos-here"
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              <Users className="size-4" aria-hidden />
              Who&apos;s here
            </Link>
            <StatusBadge
              status={isOnline ? "success" : "warning"}
              label={isOnline ? "Online" : "Offline"}
            />
          </div>
        }
      />

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
          <SelectValue placeholder="Check-in location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="general">General campus</SelectItem>
          {activities.map((activity) => (
            <SelectItem key={activity.id} value={activity.id}>
              {activity.name}
              {activity.location ? ` · ${activity.location}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeActivity && (
        <p className="text-sm text-muted-foreground">
          Activity check-in: {activeActivity.name} (
          {new Date(activeActivity.startTime).toLocaleTimeString()} –{" "}
          {new Date(activeActivity.endTime).toLocaleTimeString()})
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

      {selected && (
        <Card className="rounded-2xl border-2 border-primary/20 bg-primary/5">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <Avatar className="size-14 rounded-2xl">
                <AvatarFallback className="rounded-2xl text-lg">
                  {selected.firstName.charAt(0)}
                  {selected.lastName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold">
                  {selected.firstName} {selected.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeActivity?.name ?? "General campus"}
                </p>
                <div className="mt-2">
                  <MedicalFlagBadge student={selected} />
                </div>
              </div>
              <StatusBadge
                status={isCheckedIn ? "success" : "neutral"}
                label={isCheckedIn ? "Checked in" : "Not here"}
              />
            </div>

            <Button
              className={cn(
                "min-h-14 w-full text-base font-semibold",
                isCheckedIn
                  ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  : "",
              )}
              onClick={() => void handleToggle()}
              aria-label={
                isCheckedIn
                  ? `Check out ${selected.firstName} ${selected.lastName}`
                  : `Check in ${selected.firstName} ${selected.lastName}`
              }
            >
              {isCheckedIn ? (
                <>
                  <LogOut className="size-5" aria-hidden />
                  Check out
                </>
              ) : (
                <>
                  <LogIn className="size-5" aria-hidden />
                  Check in
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <ul className="grid gap-2" aria-label="Student roster">
        {filtered.map((student) => {
          const checkedIn = openMap.has(scopeKey(student.id, activityId));
          const active = selectedId === student.id;

          return (
            <li key={student.id}>
            <button
              type="button"
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                active ? "border-primary bg-primary/10" : "hover:bg-muted/50",
              )}
              onClick={() => setSelectedId(student.id)}
              aria-pressed={active}
              aria-label={`${student.firstName} ${student.lastName}, ${checkedIn ? "checked in" : "not checked in"}`}
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
                </p>
              </div>
              <StatusBadge
                status={checkedIn ? "success" : "neutral"}
                label={checkedIn ? "In" : "Out"}
              />
            </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
