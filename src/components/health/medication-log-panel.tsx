"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StudentMedOption = {
  id: string;
  name: string;
  medicalProfileId: string | null;
};

type MedicationLogEntry = {
  id: string;
  studentName: string;
  medicationName: string;
  dosage: string | null;
  notes: string | null;
  administeredAt: string;
  administeredByName: string | null;
};

type MedicationLogPanelProps = {
  students: StudentMedOption[];
  logs: MedicationLogEntry[];
};

export function MedicationLogPanel({ students, logs }: MedicationLogPanelProps) {
  const router = useRouter();
  const [profileId, setProfileId] = useState("");
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const studentsWithProfile = students.filter((student) => student.medicalProfileId);

  async function logDose(event: React.FormEvent) {
    event.preventDefault();
    if (!profileId || !medicationName.trim()) return;
    setIsSaving(true);

    const response = await fetch("/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "medication",
        medicalProfileId: profileId,
        medicationName: medicationName.trim(),
        dosage: dosage || undefined,
        notes: notes || undefined,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      toast.error("Could not log dose");
      return;
    }

    toast.success("Dose recorded with timestamp and staff ID");
    setMedicationName("");
    setDosage("");
    setNotes("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pill className="size-5" aria-hidden />
            Log medication dose
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Each entry records medication, dose, administering staff, and exact time.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={logDose} className="space-y-3">
            <div className="space-y-2">
              <Label>Student</Label>
              <select
                className="min-h-11 w-full rounded-xl border bg-background px-3"
                value={profileId}
                onChange={(event) => setProfileId(event.target.value)}
                required
              >
                <option value="">Select student</option>
                {studentsWithProfile.map((student) => (
                  <option key={student.id} value={student.medicalProfileId!}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Medication</Label>
              <Input
                value={medicationName}
                onChange={(event) => setMedicationName(event.target.value)}
                placeholder="e.g. Ibuprofen, EpiPen"
                required
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Dosage</Label>
              <Input
                value={dosage}
                onChange={(event) => setDosage(event.target.value)}
                placeholder="e.g. 200mg, 1 puff"
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-11"
              />
            </div>
            <Button type="submit" className="min-h-11 w-full" disabled={isSaving}>
              {isSaving ? "Recording..." : "Record dose"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Administration log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No doses logged yet.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border bg-muted/20 p-3 text-sm"
              >
                <p className="font-medium">
                  {log.studentName} — {log.medicationName}
                  {log.dosage ? ` (${log.dosage})` : ""}
                </p>
                <p className="text-muted-foreground">
                  {new Date(log.administeredAt).toLocaleString()} · Administered by{" "}
                  {log.administeredByName ?? "Staff"}
                </p>
                {log.notes && (
                  <p className="mt-1 text-muted-foreground">{log.notes}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
