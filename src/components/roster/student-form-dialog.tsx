"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StudentFormInput } from "@/lib/validations/student";

type TeamOption = {
  id: string;
  name: string;
};

type StudentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamOption[];
  initialValues?: Partial<StudentFormInput>;
  studentId?: string;
  title: string;
  description: string;
  submitLabel: string;
};

const emptyValues: StudentFormInput = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  grade: "",
  teamId: "",
  allergies: "",
  medications: "",
  conditions: "",
  guardianName: "",
  guardianEmail: "",
  guardianPhone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
  emergencyContactEmail: "",
};

export function StudentFormDialog({
  open,
  onOpenChange,
  teams,
  initialValues,
  studentId,
  title,
  description,
  submitLabel,
}: StudentFormDialogProps) {
  const router = useRouter();
  const values = { ...emptyValues, ...initialValues };
  const [isLoading, setIsLoading] = useState(false);
  const [teamId, setTeamId] = useState(values.teamId ?? "");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload: StudentFormInput = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
      grade: String(formData.get("grade") ?? ""),
      teamId,
      allergies: String(formData.get("allergies") ?? ""),
      medications: String(formData.get("medications") ?? ""),
      conditions: String(formData.get("conditions") ?? ""),
      guardianName: String(formData.get("guardianName") ?? ""),
      guardianEmail: String(formData.get("guardianEmail") ?? ""),
      guardianPhone: String(formData.get("guardianPhone") ?? ""),
      emergencyContactName: String(formData.get("emergencyContactName") ?? ""),
      emergencyContactPhone: String(formData.get("emergencyContactPhone") ?? ""),
      emergencyContactRelationship: String(
        formData.get("emergencyContactRelationship") ?? "",
      ),
      emergencyContactEmail: String(formData.get("emergencyContactEmail") ?? ""),
    };

    const response = await fetch(
      studentId ? `/api/students/${studentId}` : "/api/students",
      {
        method: studentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();
    setIsLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Could not save student");
      return;
    }

    toast.success(studentId ? "Student updated" : "Student added");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={values.firstName}
                className="min-h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={values.lastName}
                className="min-h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                defaultValue={values.dateOfBirth}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">Grade</Label>
              <Input
                id="grade"
                name="grade"
                defaultValue={values.grade}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="teamId">Team / cabin</Label>
              <Select value={teamId || undefined} onValueChange={(value) => setTeamId(value ?? "")}>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Medical flags</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="allergies">Allergies</Label>
                <Textarea
                  id="allergies"
                  name="allergies"
                  defaultValue={values.allergies}
                  placeholder="Peanuts, latex..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medications">Medications</Label>
                <Textarea
                  id="medications"
                  name="medications"
                  defaultValue={values.medications}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conditions">Conditions</Label>
                <Textarea
                  id="conditions"
                  name="conditions"
                  defaultValue={values.conditions}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Guardian & emergency contact</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="guardianName">Guardian name</Label>
                <Input
                  id="guardianName"
                  name="guardianName"
                  defaultValue={values.guardianName}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardianEmail">Guardian email</Label>
                <Input
                  id="guardianEmail"
                  name="guardianEmail"
                  type="email"
                  defaultValue={values.guardianEmail}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardianPhone">Guardian phone</Label>
                <Input
                  id="guardianPhone"
                  name="guardianPhone"
                  defaultValue={values.guardianPhone}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactName">Emergency contact</Label>
                <Input
                  id="emergencyContactName"
                  name="emergencyContactName"
                  defaultValue={values.emergencyContactName}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone">Emergency phone</Label>
                <Input
                  id="emergencyContactPhone"
                  name="emergencyContactPhone"
                  defaultValue={values.emergencyContactPhone}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactRelationship">Relationship</Label>
                <Input
                  id="emergencyContactRelationship"
                  name="emergencyContactRelationship"
                  defaultValue={values.emergencyContactRelationship}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactEmail">Emergency email</Label>
                <Input
                  id="emergencyContactEmail"
                  name="emergencyContactEmail"
                  type="email"
                  defaultValue={values.emergencyContactEmail}
                  className="min-h-11"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={isLoading}>
              {isLoading ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
