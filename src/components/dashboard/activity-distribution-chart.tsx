"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type ChartEvent,
  type ActiveElement,
  type ChartData,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/design-system/status-badge";
import type { ActivityDistributionSlice } from "@/lib/attendance/activity-distribution";
import { cn } from "@/lib/utils";

ChartJS.register(ArcElement, Tooltip, Legend);

type ActivityDistributionChartProps = {
  initialSlices: ActivityDistributionSlice[];
  initialTotalStudents: number;
  pollIntervalMs?: number;
};

export function ActivityDistributionChart({
  initialSlices,
  initialTotalStudents,
  pollIntervalMs = 20_000,
}: ActivityDistributionChartProps) {
  const router = useRouter();
  const [slices, setSlices] = useState(initialSlices);
  const [totalStudents, setTotalStudents] = useState(initialTotalStudents);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const slicesRef = useRef(slices);
  slicesRef.current = slices;

  useEffect(() => {
    async function refresh() {
      const response = await fetch("/api/dashboard/activity-distribution");
      if (!response.ok) return;
      const data = await response.json();
      setSlices(data.slices ?? []);
      setTotalStudents(data.totalStudents ?? 0);
      setUpdatedAt(data.updatedAt ?? null);
    }

    void refresh();
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  const chartData: ChartData<"doughnut"> = useMemo(
    () => ({
      labels: slices.map((slice) => slice.label),
      datasets: [
        {
          data: slices.map((slice) => slice.count),
          backgroundColor: slices.map((slice) => slice.color),
          borderColor: "transparent",
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }),
    [slices],
  );

  function goToSlice(index: number) {
    const slice = slicesRef.current[index];
    if (!slice || slice.count === 0) return;
    router.push(`/checkin/whos-here?activityId=${encodeURIComponent(slice.key)}`);
  }

  const hasData = slices.some((slice) => slice.count > 0);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <PieChart className="size-4 text-muted-foreground" aria-hidden />
          Where students are now
        </CardTitle>
        <StatusBadge status="success" label="Live" />
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No students in this session yet.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_1fr] lg:items-center">
            <div className="relative mx-auto w-full max-w-[240px]">
              <Doughnut
                data={chartData}
                options={{
                  cutout: "58%",
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label(context) {
                          const value = context.parsed;
                          const pct =
                            totalStudents > 0
                              ? Math.round((value / totalStudents) * 100)
                              : 0;
                          return ` ${context.label}: ${value} (${pct}%)`;
                        },
                      },
                    },
                  },
                  onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
                    if (elements[0]) goToSlice(elements[0].index);
                  },
                  onHover: (event, elements) => {
                    const target = event.native?.target as HTMLElement | undefined;
                    if (target) {
                      target.style.cursor = elements.length ? "pointer" : "default";
                    }
                  },
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold tabular-nums">{totalStudents}</p>
                <p className="text-xs text-muted-foreground">students</p>
              </div>
            </div>

            <ul className="grid gap-2 sm:grid-cols-2" aria-label="Activity distribution legend">
              {slices.map((slice, index) => (
                <li key={slice.key}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full min-h-11 items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                    )}
                    onClick={() => goToSlice(index)}
                  >
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {slice.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {slice.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {updatedAt && (
          <p className="mt-4 text-xs text-muted-foreground">
            Updated {new Date(updatedAt).toLocaleTimeString()} · tap a slice to
            open Who&apos;s here
          </p>
        )}
      </CardContent>
    </Card>
  );
}
