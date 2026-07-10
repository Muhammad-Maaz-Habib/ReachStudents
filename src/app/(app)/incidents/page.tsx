import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { IncidentsHub } from "@/components/health/incidents-hub";

export default async function IncidentsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  const [canView, canEdit] = await Promise.all([
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.INCIDENTS,
      "view",
    ),
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.INCIDENTS,
      "edit",
    ),
  ]);
  if (!canView) redirect("/dashboard");

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const students = await prisma.student.findMany({
    where: { sessionId: campSession.id },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <IncidentsHub
      canEdit={canEdit}
      students={students.map((student) => ({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
      }))}
    />
  );
}
