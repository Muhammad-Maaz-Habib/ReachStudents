"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Search, Siren } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { MedicalFlagBadge } from "@/components/roster/medical-flag-badge";
import { StatusBadge } from "@/components/design-system/status-badge";
import { EmptyState } from "@/components/design-system/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { activityOptionLabel } from "@/lib/validations/activity";
import { buttonVariants } from "@/components/ui/button";

type CheckInRow = {
  id: string;
  checkedInAt: string;
  notCheckedIn?: boolean;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    grade: string | null;
    team: { id: string; name: string; color: string | null } | null;
    medicalProfile: {
      allergies: string | null;
      medications: string | null;
      conditions: string | null;
    } | null;
  };
  activity: { id: string; name: string; location: string | null } | null;
};

type WhosHereListProps = {
  sessionName: string;
  total: number;
  checkIns: CheckInRow[];
  teams: { id: string; name: string; color: string | null }[];
  activities: {
    id: string;
    name: string;
    startTime: string;
    location: string | null;
  }[];
  initialQuery: string;
  initialTeamId?: string;
  initialActivityId?: string;
  initialLocation?: string;
  previewLimit?: number;
  showViewAllLink?: boolean;
  compact?: boolean;
};

export function WhosHereList({
  sessionName,
  total,
  checkIns,
  teams,
  activities,
  initialQuery,
  initialTeamId,
  initialActivityId,
  initialLocation,
  previewLimit,
  showViewAllLink = false,
  compact = false,
}: WhosHereListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);

  const displayed = previewLimit ? checkIns.slice(0, previewLimit) : checkIns;

  const subtitle = useMemo(() => {
    if (initialActivityId === "not_checked_in") {
      return `${total} not checked in · ${sessionName}`;
    }
    if (initialLocation) {
      const label =
        initialLocation === "__unknown__"
          ? "No location set"
          : initialLocation;
      return `${total} at ${label} · ${sessionName}`;
    }
    if (previewLimit && total > previewLimit) {
      return `Showing ${previewLimit} of ${total} checked in`;
    }
    return `${total} checked in · ${sessionName}`;
  }, [previewLimit, total, sessionName, initialActivityId, initialLocation]);

  function updateFilters(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });
    startTransition(() => {
      router.push(`/checkin/whos-here?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <PageHeader
          title="Who's here"
          description={subtitle}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="success" label={`${total} on site`} />
              <Link
                href="/checkin/whos-here?mode=rollcall"
                className={cn(
                  buttonVariants({ variant: "destructive", size: "sm" }),
                  "min-h-9",
                )}
              >
                <Siren className="size-4" aria-hidden />
                Roll-call
              </Link>
            </div>
          }
        />
      )}

      {compact && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Who&apos;s here now</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <StatusBadge status="success" label={`${total} on site`} />
        </div>
      )}

      {!previewLimit && initialLocation && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-sm">
          <p>
            Filtered by campus location:{" "}
            <span className="font-medium text-foreground">
              {initialLocation === "__unknown__"
                ? "No location set"
                : initialLocation}
            </span>
          </p>
          <Link
            href="/checkin/map"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-9")}
          >
            Back to campus map
          </Link>
        </div>
      )}

      {!previewLimit && (
        <div className="grid gap-3 lg:grid-cols-3">
          <form
            className="relative lg:col-span-1"
            onSubmit={(event) => {
              event.preventDefault();
              updateFilters({ q: query || undefined });
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search students..."
              className="min-h-11 pl-9"
            />
          </form>

          <Select
            value={initialTeamId ?? "all"}
            onValueChange={(value) =>
              updateFilters({ teamId: !value || value === "all" ? undefined : value })
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
            value={initialActivityId ?? "all"}
            onValueChange={(value) =>
              updateFilters({
                activityId: !value || value === "all" ? undefined : value,
                location: undefined,
              })
            }
          >
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue placeholder="All locations">
                {(value) => {
                  if (!value || value === "all") return "All check-in types";
                  if (value === "general") return "General campus only";
                  if (value === "not_checked_in") return "Not checked in";
                  const activity = activities.find((row) => row.id === value);
                  return activity ? activity.name : "All locations";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="All check-in types">
                All check-in types
              </SelectItem>
              <SelectItem value="general" label="General campus only">
                General campus only
              </SelectItem>
              <SelectItem value="not_checked_in" label="Not checked in">
                Not checked in
              </SelectItem>
              {activities.map((activity) => (
                <SelectItem
                  key={activity.id}
                  value={activity.id}
                  label={activity.name}
                >
                  {activity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isPending && (
        <p className="text-sm text-muted-foreground">Updating headcount...</p>
      )}

      {displayed.length === 0 ? (
        <EmptyState
          title="No students match"
          description="Try adjusting filters or check students in from the check-in flow."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {displayed.map((checkIn) => (
            <li
              key={checkIn.id}
              className="flex flex-col gap-2 rounded-xl border bg-muted/20 px-4 py-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {checkIn.student.firstName} {checkIn.student.lastName}
                  </p>
                  <p className="text-muted-foreground">
                    {checkIn.student.team?.name ?? "Unassigned"}
                    {checkIn.student.grade
                      ? ` · Grade ${checkIn.student.grade}`
                      : ""}
                  </p>
                </div>
                <MedicalFlagBadge student={checkIn.student} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {checkIn.notCheckedIn ? (
                  <span>Not checked in</span>
                ) : (
                  <>
                    <span>
                      In since {new Date(checkIn.checkedInAt).toLocaleTimeString()}
                    </span>
                    <span>·</span>
                    <span>
                      {checkIn.activity?.name ?? "General campus"}
                      {checkIn.activity?.location
                        ? ` @ ${checkIn.activity.location}`
                        : ""}
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showViewAllLink && total > (previewLimit ?? 0) && (
        <div className="flex justify-end">
          <Link
            href="/checkin/whos-here"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
          >
            View all ({total})
          </Link>
        </div>
      )}
    </div>
  );
}
