"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/design-system/status-badge";

type CertAlert = {
  id: string;
  type: string;
  label: string | null;
  expiresAt: string;
  staff: { id: string; name: string | null; email: string; role: string };
};

type CertificationAlertsPanelProps = {
  defaultWindowDays?: number;
};

export function CertificationAlertsPanel({
  defaultWindowDays = 14,
}: CertificationAlertsPanelProps) {
  const [windowDays, setWindowDays] = useState(defaultWindowDays);
  const [expired, setExpired] = useState<CertAlert[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<CertAlert[]>([]);

  useEffect(() => {
    async function load() {
      const response = await fetch(
        `/api/staff/certifications/expiring?days=${windowDays}`,
      );
      if (!response.ok) return;
      const data = await response.json();
      setExpired(data.expired ?? []);
      setExpiringSoon(data.expiringSoon ?? []);
    }
    void load();
  }, [windowDays]);

  if (expired.length === 0 && expiringSoon.length === 0) {
    return (
      <Card className="rounded-2xl border-green-200/50 bg-green-50/30 dark:border-green-900/30 dark:bg-green-950/20">
        <CardContent className="flex items-center gap-3 pt-6">
          <ShieldAlert className="size-5 text-green-700" aria-hidden />
          <p className="text-sm">
            No staff certifications expired or expiring in the next {windowDays}{" "}
            days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-amber-200/60 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="size-5 text-amber-700" aria-hidden />
          Certification alerts
        </CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="cert-window" className="text-sm whitespace-nowrap">
            Window (days)
          </Label>
          <Input
            id="cert-window"
            type="number"
            min={1}
            max={90}
            value={windowDays}
            onChange={(event) =>
              setWindowDays(Math.max(1, Number(event.target.value) || 14))
            }
            className="h-9 w-20"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {expired.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-destructive">
              Expired ({expired.length})
            </p>
            {expired.map((cert) => (
              <div
                key={cert.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-background p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {cert.staff.name ?? cert.staff.email} —{" "}
                    {cert.label ?? cert.type}
                  </p>
                  <p className="text-muted-foreground">
                    Expired {new Date(cert.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status="danger" label="Expired" />
              </div>
            ))}
          </div>
        )}
        {expiringSoon.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Expiring within {windowDays} days ({expiringSoon.length})
            </p>
            {expiringSoon.map((cert) => (
              <div
                key={cert.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {cert.staff.name ?? cert.staff.email} —{" "}
                    {cert.label ?? cert.type}
                  </p>
                  <p className="text-muted-foreground">
                    Expires {new Date(cert.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status="warning" label="Expiring" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
