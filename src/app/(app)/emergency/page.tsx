import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/constants";
import { EmergencyHub } from "@/components/emergency/emergency-hub";

export default async function EmergencyPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  if (!STAFF_ROLES.includes(session.user.role)) redirect("/dashboard");

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const students = await prisma.student.findMany({
    where: { sessionId: campSession.id },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const excursions = await prisma.excursion.findMany({
    where: { sessionId: campSession.id },
    select: {
      id: true,
      name: true,
      destination: true,
      startTime: true,
    },
    orderBy: [{ startTime: "asc" }, { name: "asc" }],
  });

  const canEditProtocols = ADMIN_ROLES.includes(session.user.role);

  return (
    <EmergencyHub
      canEditProtocols={canEditProtocols}
      students={students.map((student) => ({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
      }))}
      initialExcursions={excursions.map((row) => ({
        id: row.id,
        name: row.name,
        destination: row.destination,
        startTime: row.startTime.toISOString(),
      }))}
    />
  );
}
