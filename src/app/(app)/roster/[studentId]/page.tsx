import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { studentInclude } from "@/lib/students";
import { StudentProfileView } from "@/components/roster/student-profile-view";
import {
  canEditConfidentialNotes,
  canViewConfidentialNotes,
} from "@/lib/health/confidential-access";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type StudentProfilePageProps = {
  params: Promise<{ studentId: string }>;
};

export default async function StudentProfilePage({
  params,
}: StudentProfilePageProps) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/onboarding");
  }

  const { studentId } = await params;
  const campSession = await requireOrganizationSession(session.user.organizationId);

  const [student, canEdit] = await Promise.all([
    prisma.student.findFirst({
      where: {
        id: studentId,
        sessionId: campSession.id,
      },
      include: {
        ...studentInclude,
        checkIns: {
          take: 10,
          orderBy: { checkedInAt: "desc" },
          include: {
            activity: { select: { name: true, location: true } },
            staff: { select: { name: true } },
          },
        },
        formSubmissions: {
          include: {
            form: { select: { title: true, type: true } },
          },
          orderBy: { submittedAt: "desc" },
        },
      },
    }),
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.STUDENTS,
      "edit",
    ),
  ]);

  if (!student) {
    notFound();
  }

  const canViewConfidential = canViewConfidentialNotes(session.user.role);
  const canEditConfidential = canEditConfidentialNotes(session.user.role);

  if (student.medicalProfile) {
    logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      resource: AUDIT_RESOURCES.HEALTH_RECORDS,
      action: "view",
      targetRecord: student.medicalProfile.id,
      metadata: { studentId: student.id, scope: "student_profile" },
    });
  }

  if (canViewConfidential && student.medicalProfile) {
    logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      resource: AUDIT_RESOURCES.CONFIDENTIAL_NOTES,
      action: "view",
      targetRecord: student.medicalProfile.id,
      metadata: { studentId: student.id, scope: "student_profile" },
    });
  }

  const serialized = {
    ...student,
    dateOfBirth: student.dateOfBirth?.toISOString() ?? null,
    medicalProfile: student.medicalProfile
      ? {
          id: student.medicalProfile.id,
          allergies: student.medicalProfile.allergies,
          medications: student.medicalProfile.medications,
          conditions: student.medicalProfile.conditions,
          confidentialNotes: canViewConfidential
            ? student.medicalProfile.confidentialNotes
            : null,
        }
      : null,
    checkIns: student.checkIns.map((checkIn) => ({
      ...checkIn,
      checkedInAt: checkIn.checkedInAt.toISOString(),
    })),
  };

  return (
    <StudentProfileView
      student={serialized}
      teams={campSession.teams.map((team) => ({ id: team.id, name: team.name }))}
      canEdit={canEdit}
      canViewConfidential={canViewConfidential}
      canEditConfidential={canEditConfidential}
    />
  );
}
