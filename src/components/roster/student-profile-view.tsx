"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { MedicalFlagBadge } from "@/components/roster/medical-flag-badge";
import { StudentFormDialog } from "@/components/roster/student-form-dialog";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConfidentialNotesCard } from "@/components/health/confidential-notes-card";
import type { StudentFormInput } from "@/lib/validations/student";

type TeamOption = {
  id: string;
  name: string;
};

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string | null;
  isPrimary: boolean;
};

type StudentProfile = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  grade: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  team: { id: string; name: string; color: string | null } | null;
  medicalProfile: {
    id?: string;
    allergies: string | null;
    medications: string | null;
    conditions: string | null;
    confidentialNotes?: string | null;
  } | null;
  emergencyContacts: EmergencyContact[];
  formSubmissions: { id: string; form: { title: string } }[];
  checkIns: {
    id: string;
    checkedInAt: string;
    activity: { name: string; location: string | null } | null;
    staff: { name: string | null };
  }[];
};

type StudentProfileViewProps = {
  student: StudentProfile;
  teams: TeamOption[];
  canEdit: boolean;
  canViewConfidential?: boolean;
  canEditConfidential?: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function toFormValues(student: StudentProfile): Partial<StudentFormInput> {
  const emergency = student.emergencyContacts[0];

  return {
    firstName: student.firstName,
    lastName: student.lastName,
    dateOfBirth: student.dateOfBirth
      ? new Date(student.dateOfBirth).toISOString().slice(0, 10)
      : "",
    grade: student.grade ?? "",
    teamId: student.team?.id ?? "",
    allergies: student.medicalProfile?.allergies ?? "",
    medications: student.medicalProfile?.medications ?? "",
    conditions: student.medicalProfile?.conditions ?? "",
    guardianName: student.guardianName ?? "",
    guardianEmail: student.guardianEmail ?? "",
    guardianPhone: student.guardianPhone ?? "",
    emergencyContactName: emergency?.name ?? "",
    emergencyContactPhone: emergency?.phone ?? "",
    emergencyContactRelationship: emergency?.relationship ?? "",
    emergencyContactEmail: emergency?.email ?? "",
  };
}

export function StudentProfileView({
  student,
  teams,
  canEdit,
  canViewConfidential = false,
  canEditConfidential = false,
}: StudentProfileViewProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/roster"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11 rounded-xl")}
          aria-label="Back to roster"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar className="size-16 rounded-2xl">
            <AvatarFallback className="rounded-2xl bg-secondary text-lg text-secondary-foreground">
              {student.firstName.charAt(0)}
              {student.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <PageHeader
              title={`${student.firstName} ${student.lastName}`}
              description={student.team?.name ?? "Unassigned team"}
            />
          </div>
        </div>
        {canEdit && (
          <Button className="min-h-11" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" aria-hidden />
            Edit
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {student.grade && <Badge variant="secondary">Grade {student.grade}</Badge>}
        <MedicalFlagBadge student={student} />
        <StatusBadge status="info" label={`DOB ${formatDate(student.dateOfBirth)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Guardian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{student.guardianName ?? "Not provided"}</p>
            <p className="text-muted-foreground">{student.guardianEmail ?? "—"}</p>
            <p className="text-muted-foreground">{student.guardianPhone ?? "—"}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Emergency contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {student.emergencyContacts.length === 0 ? (
              <p className="text-muted-foreground">No emergency contacts on file.</p>
            ) : (
              student.emergencyContacts.map((contact) => (
                <div key={contact.id} className="rounded-xl border bg-muted/20 p-3">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-muted-foreground">
                    {contact.relationship ?? "Contact"} · {contact.phone}
                  </p>
                  {contact.email && (
                    <p className="text-muted-foreground">{contact.email}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>Medical profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
            <div>
              <p className="font-medium text-destructive">Allergies</p>
              <p className="mt-1 text-muted-foreground">
                {student.medicalProfile?.allergies ?? "None listed"}
              </p>
            </div>
            <div>
              <p className="font-medium">Medications</p>
              <p className="mt-1 text-muted-foreground">
                {student.medicalProfile?.medications ?? "None listed"}
              </p>
            </div>
            <div>
              <p className="font-medium">Conditions</p>
              <p className="mt-1 text-muted-foreground">
                {student.medicalProfile?.conditions ?? "None listed"}
              </p>
            </div>
          </CardContent>
        </Card>

        {canViewConfidential && student.medicalProfile?.id && (
          <ConfidentialNotesCard
            medicalProfileId={student.medicalProfile.id}
            initialNotes={student.medicalProfile.confidentialNotes ?? null}
            canEdit={canEditConfidential}
          />
        )}

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Forms</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {student.formSubmissions.length === 0 ? (
              <p className="text-muted-foreground">
                No completed forms yet — tracking arrives in Stage 7.
              </p>
            ) : (
              <ul className="space-y-2">
                {student.formSubmissions.map((submission) => (
                  <li key={submission.id}>{submission.form.title}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {student.checkIns.length === 0 ? (
              <p className="text-muted-foreground">
                No check-ins yet — activity history fills in during Stage 3.
              </p>
            ) : (
              <ul className="space-y-2">
                {student.checkIns.map((checkIn) => (
                  <li key={checkIn.id} className="rounded-xl border bg-muted/20 p-3">
                    <p className="font-medium">
                      {checkIn.activity?.name ?? "General check-in"}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(checkIn.checkedInAt).toLocaleString()} ·{" "}
                      {checkIn.staff.name ?? "Staff"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <StudentFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          teams={teams}
          studentId={student.id}
          initialValues={toFormValues(student)}
          title="Edit student"
          description="Update roster details, medical flags, and contacts."
          submitLabel="Save changes"
        />
      )}
    </div>
  );
}
