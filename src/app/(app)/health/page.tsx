import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { HealthDashboard } from "@/components/health/health-dashboard";

export default async function HealthPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  const canView = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.HEALTH_RECORDS,
    "view",
  );
  if (!canView) redirect("/dashboard");

  const canEditMedical = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.HEALTH_RECORDS,
    "edit",
  );

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const [students, medicationLogs] = await Promise.all([
    prisma.student.findMany({
      where: { sessionId: campSession.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        medicalProfile: { select: { id: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.medicationLog.findMany({
      where: {
        medicalProfile: { student: { sessionId: campSession.id } },
      },
      include: {
        medicalProfile: {
          include: { student: { select: { firstName: true, lastName: true } } },
        },
        administeredBy: { select: { name: true } },
      },
      orderBy: { administeredAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <HealthDashboard
      canEditMedical={canEditMedical}
      students={students.map((student) => ({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        medicalProfileId: student.medicalProfile?.id ?? null,
      }))}
      initialMedicationLogs={medicationLogs.map((log) => ({
        id: log.id,
        studentName: `${log.medicalProfile.student.firstName} ${log.medicalProfile.student.lastName}`,
        medicationName: log.medicationName,
        dosage: log.dosage,
        notes: log.notes,
        administeredAt: log.administeredAt.toISOString(),
        administeredByName: log.administeredBy.name,
      }))}
    />
  );
}
