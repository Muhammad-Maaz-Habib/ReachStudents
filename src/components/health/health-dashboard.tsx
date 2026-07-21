"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { ImportHealthDialog } from "@/components/health/import-health-dialog";
import { MedicationLogPanel } from "@/components/health/medication-log-panel";
import { WellnessCheckIn } from "@/components/health/wellness-check-in";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HealthDashboardProps = {
  canEditMedical: boolean;
  canImportHealth?: boolean;
  students: { id: string; name: string; medicalProfileId: string | null }[];
  initialMedicationLogs: {
    id: string;
    studentName: string;
    medicationName: string;
    dosage: string | null;
    notes: string | null;
    administeredAt: string;
    administeredByName: string | null;
  }[];
};

type HealthData = {
  medicalProfiles: {
    studentId: string;
    studentName: string;
    allergies: string | null;
    medications: string | null;
    conditions: string | null;
  }[];
};

export function HealthDashboard({
  canEditMedical,
  canImportHealth = false,
  students,
  initialMedicationLogs,
}: HealthDashboardProps) {
  const [data, setData] = useState<HealthData | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/health");
      if (!response.ok) return;
      const json = await response.json();
      setData({ medicalProfiles: json.medicalProfiles ?? [] });
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Health & wellness"
        description="Medication accountability log, emoji wellness taps, and medical flags."
        action={
          canImportHealth ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-4" aria-hidden />
              Import health CSV
            </Button>
          ) : undefined
        }
      />

      <WellnessCheckIn students={students} />

      {canEditMedical && (
        <MedicationLogPanel students={students} logs={initialMedicationLogs} />
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Students with medical flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.medicalProfiles ?? []).map((profile) => (
            <div
              key={profile.studentId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
            >
              <div>
                <p className="font-medium">{profile.studentName}</p>
                <p className="text-muted-foreground">
                  {[
                    profile.allergies && `Allergies: ${profile.allergies}`,
                    profile.medications && `Meds: ${profile.medications}`,
                    profile.conditions && `Conditions: ${profile.conditions}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Profile on file"}
                </p>
              </div>
              <Link
                href={`/roster/${profile.studentId}`}
                className={cn(buttonVariants({ variant: "outline" }), "min-h-9")}
              >
                View profile
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>

      {canImportHealth && (
        <ImportHealthDialog open={importOpen} onOpenChange={setImportOpen} />
      )}
    </div>
  );
}
