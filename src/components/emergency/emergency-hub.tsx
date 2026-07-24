"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MapPin, Siren } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import {
  ProtocolEditorPanel,
  ProtocolViewHeader,
} from "@/components/emergency/protocol-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Protocol = {
  id: string;
  type: string;
  title: string;
  steps: { id: string; text: string; order: number }[];
};

type TripCheckIn = {
  id: string;
  studentName: string;
  tripLabel: string | null;
  excursionName: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
};

type ExcursionOption = {
  id: string;
  name: string;
  destination: string | null;
  startTime: string;
};

type EmergencyHubProps = {
  canEditProtocols: boolean;
  students: { id: string; name: string }[];
  initialExcursions?: ExcursionOption[];
};

export function EmergencyHub({
  canEditProtocols,
  students,
  initialExcursions = [],
}: EmergencyHubProps) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [isEditingProtocol, setIsEditingProtocol] = useState(false);
  const [tripCheckIns, setTripCheckIns] = useState<TripCheckIn[]>([]);
  const [excursions, setExcursions] =
    useState<ExcursionOption[]>(initialExcursions);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [excursionId, setExcursionId] = useState("");
  const [tripLabel, setTripLabel] = useState("");
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    async function load() {
      const [protocolRes, tripRes] = await Promise.all([
        fetch("/api/emergency/protocols"),
        fetch("/api/emergency/trip-checkin"),
      ]);
      if (protocolRes.ok) {
        const data = await protocolRes.json();
        setProtocols(data.protocols ?? []);
        if (data.protocols?.[0]) setActiveType(data.protocols[0].type);
      }
      if (tripRes.ok) {
        const data = await tripRes.json();
        setTripCheckIns(data.checkIns ?? []);
        if (Array.isArray(data.excursions)) {
          setExcursions(data.excursions);
        }
      }
    }
    void load();
  }, []);

  const active = protocols.find((protocol) => protocol.type === activeType);

  function selectProtocol(type: string) {
    setActiveType(type);
    setIsEditingProtocol(false);
  }

  async function recordTripLocation() {
    if (!studentId) return;
    setIsPinging(true);

    if (!navigator.geolocation) {
      toast.error("Location not available on this device");
      setIsPinging(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const response = await fetch("/api/emergency/trip-checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            excursionId: excursionId || undefined,
            tripLabel: tripLabel || undefined,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          }),
        });
        setIsPinging(false);
        if (!response.ok) {
          toast.error("Could not record location");
          return;
        }
        toast.success("Trip location recorded (opt-in)");
        const tripRes = await fetch("/api/emergency/trip-checkin");
        if (tripRes.ok) {
          const data = await tripRes.json();
          setTripCheckIns(data.checkIns ?? []);
          if (Array.isArray(data.excursions)) {
            setExcursions(data.excursions);
          }
        }
      },
      () => {
        setIsPinging(false);
        toast.error("Location permission denied");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency"
        description="One-tap protocols, roll-call headcount, and off-site location pings."
        action={
          <Link
            href="/checkin/whos-here?mode=rollcall"
            className={cn(buttonVariants({ variant: "destructive" }), "min-h-11")}
          >
            <Siren className="size-4" aria-hidden />
            Start roll-call
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {protocols.map((protocol) => (
          <button
            key={protocol.type}
            type="button"
            className={cn(
              "min-h-16 rounded-2xl border px-4 py-3 text-left font-semibold transition-colors",
              activeType === protocol.type
                ? "border-destructive bg-destructive text-destructive-foreground"
                : "bg-muted/30 hover:bg-muted/60",
            )}
            onClick={() => selectProtocol(protocol.type)}
          >
            {protocol.title}
          </button>
        ))}
      </div>

      {active && (
        <Card className="rounded-2xl border-destructive/30">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">
                {isEditingProtocol ? "Edit protocol" : active.title}
              </CardTitle>
              {canEditProtocols && !isEditingProtocol && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Customize steps for your camp. Changes apply organization-wide.
                </p>
              )}
            </div>
            <ProtocolViewHeader
              canEdit={canEditProtocols}
              isEditing={isEditingProtocol}
              onEdit={() => setIsEditingProtocol(true)}
            />
          </CardHeader>
          <CardContent>
            {isEditingProtocol ? (
              <ProtocolEditorPanel
                protocol={active}
                onCancel={() => setIsEditingProtocol(false)}
                onSaved={(updated) => {
                  setProtocols((current) =>
                    current.map((protocol) =>
                      protocol.type === updated.type ? updated : protocol,
                    ),
                  );
                  setIsEditingProtocol(false);
                }}
              />
            ) : (
              <ol className="space-y-3">
                {[...active.steps]
                  .sort((a, b) => a.order - b.order)
                  .map((step, index) => (
                    <li
                      key={step.id}
                      className="flex gap-3 rounded-xl border bg-muted/20 p-3 text-sm"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 font-bold text-destructive">
                        {index + 1}
                      </span>
                      <p className="pt-1">{step.text}</p>
                    </li>
                  ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="size-5" aria-hidden />
            Off-site trip location (opt-in)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Staff-initiated, one-time GPS ping for field trips — not continuous
            tracking. Requires browser location permission on the staff device.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Parent disclosure:</strong> covered by the Activity
            permission slip checkbox for trip location check-ins. Send a
            trip-specific permission slip before departure. See{" "}
            <code className="text-xs">docs/TRIP_LOCATION_PRIVACY.md</code>.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Retention:</strong> pings are hard-deleted after 24 hours
            (daily 04:00 UTC cleanup + purge on each trip-checkin API call). Only
            the last 24h appears below; older rows are hidden even if cron has
            not run yet.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Student</Label>
              <select
                className="min-h-11 w-full rounded-xl border bg-background px-3"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Excursion (optional)</Label>
              <select
                className="min-h-11 w-full rounded-xl border bg-background px-3"
                value={excursionId}
                onChange={(event) => setExcursionId(event.target.value)}
              >
                <option value="">No linked excursion</option>
                {excursions.map((excursion) => (
                  <option key={excursion.id} value={excursion.id}>
                    {excursion.name}
                    {excursion.destination ? ` — ${excursion.destination}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Trip label override (optional)</Label>
              <Input
                value={tripLabel}
                onChange={(event) => setTripLabel(event.target.value)}
                placeholder={
                  excursionId
                    ? "Defaults to excursion name if blank"
                    : "e.g. River hike"
                }
                className="min-h-11"
              />
              {excursions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No excursions yet — add them under{" "}
                  <Link href="/excursions" className="underline">
                    Excursions
                  </Link>
                  , or type a free-text label.
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            className="min-h-11"
            disabled={isPinging}
            onClick={() => void recordTripLocation()}
          >
            {isPinging ? "Getting location..." : "Record location now"}
          </Button>

          {tripCheckIns.length > 0 && (
            <ul className="space-y-2 pt-2 text-sm">
              {tripCheckIns.slice(0, 8).map((row) => {
                const label =
                  row.excursionName ?? row.tripLabel ?? null;
                return (
                  <li key={row.id} className="rounded-xl border bg-muted/20 p-3">
                    <p className="font-medium">
                      {row.studentName}
                      {label ? ` · ${label}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()} ·{" "}
                      {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
