import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { getAccessibleStudentIdsForStaff } from "@/lib/messaging/parent-access";
import { MessagesPageClient } from "@/components/messaging/messages-page-client";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.MESSAGING,
    "view",
  );
  if (!allowed) redirect("/dashboard");

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const accessibleIds = await getAccessibleStudentIdsForStaff(
    session.user.id,
    session.user.role,
    session.user.organizationId,
    campSession.id,
  );

  const students =
    accessibleIds === "all"
      ? await prisma.student.findMany({
          where: { sessionId: campSession.id },
          select: { id: true, firstName: true, lastName: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
      : accessibleIds.length > 0
        ? await prisma.student.findMany({
            where: { id: { in: accessibleIds } },
            select: { id: true, firstName: true, lastName: true },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          })
        : [];

  return (
    <MessagesPageClient
      students={students.map((student) => ({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
      }))}
    />
  );
}
