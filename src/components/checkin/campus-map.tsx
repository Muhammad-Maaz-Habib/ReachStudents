"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPinned, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/design-system/status-badge";
import type { LocationDistributionSlice } from "@/lib/attendance/location-distribution";
import { cn } from "@/lib/utils";

type CampusMapProps = {
  initialSlices: LocationDistributionSlice[];
  initialCheckedInCount: number;
  initialTotalStudents: number;
  pollIntervalMs?: number;
};

/**
 * Floor-plan style campus layout — spatial visualization of check-in zones only.
 * No GPS / device location.
 */
export function CampusMap({
  initialSlices,
  initialCheckedInCount,
  initialTotalStudents,
  pollIntervalMs = 20_000,
}: CampusMapProps) {
  const router = useRouter();
  const [slices, setSlices] = useState(initialSlices);
  const [checkedInCount, setCheckedInCount] = useState(initialCheckedInCount);
  const [totalStudents, setTotalStudents] = useState(initialTotalStudents);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    async function refresh() {
      const response = await fetch("/api/dashboard/location-distribution");
      if (!response.ok) return;
      const data = await response.json();
      setSlices(data.slices ?? []);
      setCheckedInCount(data.checkedInCount ?? 0);
      setTotalStudents(data.totalStudents ?? 0);
      setUpdatedAt(data.updatedAt ?? null);
    }

    void refresh();
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  function openZone(slice: LocationDistributionSlice) {
    router.push(
      `/checkin/whos-here?location=${encodeURIComponent(slice.key)}`,
    );
  }

  const namedZones = slices.filter((slice) => slice.key !== "__unknown__");
  const unknownZone = slices.find((slice) => slice.key === "__unknown__");

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <MapPinned className="size-4 text-muted-foreground" aria-hidden />
          Campus map
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status="info"
            label={`${checkedInCount} of ${totalStudents} checked in`}
          />
          <StatusBadge status="success" label="Live" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Students by activity location — same check-in data as the dashboard
          chart. Not GPS or live tracking.
        </p>

        <div
          className="relative overflow-hidden rounded-2xl border"
          style={{
            background:
              "linear-gradient(160deg, #e8f0e9 0%, #d4e4d7 40%, #c5d8c9 70%, #b7cfc0 100%)",
          }}
        >
          {/* Soft path lines for floor-plan feel */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
            aria-hidden
          >
            <path
              d="M0 55% H100%"
              stroke="#1B4332"
              strokeWidth="2"
              strokeDasharray="8 10"
              fill="none"
            />
            <path
              d="M35% 0 V100%"
              stroke="#1B4332"
              strokeWidth="2"
              strokeDasharray="8 10"
              fill="none"
            />
            <path
              d="M70% 0 V100%"
              stroke="#1B4332"
              strokeWidth="1.5"
              strokeDasharray="6 8"
              fill="none"
            />
          </svg>

          <div className="relative grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {namedZones.length === 0 && !unknownZone ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                No named activity locations yet. Set a location on activities in
                Schedule, then check students in.
              </p>
            ) : (
              namedZones.map((slice) => (
                <button
                  key={slice.key}
                  type="button"
                  onClick={() => openZone(slice)}
                  className={cn(
                    "group flex min-h-[7.5rem] flex-col justify-between rounded-2xl border bg-background/90 p-4 text-left shadow-sm backdrop-blur-sm transition",
                    "hover:border-foreground/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  style={{ borderColor: `${slice.color}55` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {slice.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tap for Who&apos;s here
                      </p>
                    </div>
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-sm font-semibold text-white"
                      style={{ backgroundColor: slice.color }}
                    >
                      <Users className="size-3.5" aria-hidden />
                      {slice.count}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
                      View list →
                    </span>
                  </div>
                </button>
              ))
            )}

            {unknownZone && unknownZone.count > 0 && (
              <button
                type="button"
                onClick={() => openZone(unknownZone)}
                className={cn(
                  "flex min-h-[7.5rem] flex-col justify-between rounded-2xl border border-dashed bg-background/70 p-4 text-left backdrop-blur-sm transition",
                  "hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  namedZones.length === 0 ? "sm:col-span-2 lg:col-span-3" : "",
                )}
              >
                <div>
                  <p className="font-semibold">{unknownZone.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Checked in without an activity location
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-muted px-2.5 py-1 text-sm font-semibold">
                  <Users className="size-3.5" aria-hidden />
                  {unknownZone.count}
                </span>
              </button>
            )}
          </div>
        </div>

        {updatedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {new Date(updatedAt).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
