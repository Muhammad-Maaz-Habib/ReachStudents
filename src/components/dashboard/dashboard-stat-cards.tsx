"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MapPin, Users } from "lucide-react";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardStats = {
  checkedInNow: number;
  missingCount: number;
  studentCount: number;
  teamCount: number;
};

type DashboardStatCardsProps = {
  initial: DashboardStats;
  pollIntervalMs?: number;
};

const STATS = [
  {
    key: "checkedInNow" as const,
    label: "Checked in now",
    href: "/checkin/whos-here",
    icon: MapPin,
    status: (value: number) =>
      value > 0 ? ("success" as const) : ("neutral" as const),
  },
  {
    key: "missingCount" as const,
    label: "Missing from activity",
    href: "/checkin/missing",
    icon: AlertTriangle,
    status: (value: number) =>
      value > 0 ? ("danger" as const) : ("success" as const),
  },
  {
    key: "studentCount" as const,
    label: "Students",
    href: "/roster",
    icon: Users,
    status: () => "info" as const,
  },
  {
    key: "teamCount" as const,
    label: "Teams",
    href: "/roster?view=teams",
    icon: Users,
    status: () => "neutral" as const,
  },
];

export function DashboardStatCards({
  initial,
  pollIntervalMs = 20_000,
}: DashboardStatCardsProps) {
  const [stats, setStats] = useState(initial);

  useEffect(() => {
    setStats(initial);
  }, [initial]);

  useEffect(() => {
    async function refresh() {
      const response = await fetch("/api/dashboard/stats");
      if (!response.ok) return;
      const data = (await response.json()) as DashboardStats;
      setStats({
        checkedInNow: data.checkedInNow ?? 0,
        missingCount: data.missingCount ?? 0,
        studentCount: data.studentCount ?? 0,
        teamCount: data.teamCount ?? 0,
      });
    }

    void refresh();
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATS.map((stat) => {
        const value = stats[stat.key];
        const Icon = stat.icon;
        return (
          <Link
            key={stat.key}
            href={stat.href}
            className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`${stat.label}: ${value}. View details`}
          >
            <Card
              className={cn(
                "h-full rounded-2xl shadow-sm transition-colors",
                "group-hover:bg-muted/40 group-hover:ring-1 group-hover:ring-foreground/10",
                "cursor-pointer",
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                  {stat.label}
                </CardTitle>
                <Icon
                  className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden
                />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">{value}</p>
                <div className="mt-2">
                  <StatusBadge status={stat.status(value)} label="Live" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
