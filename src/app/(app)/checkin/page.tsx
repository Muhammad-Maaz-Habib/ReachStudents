import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { getOpenCheckInsForSession } from "@/lib/checkin/server";
import { CheckInFlow } from "@/components/checkin/checkin-flow";

export default async function CheckInPage() {
  const session = await auth();
  if (!session?.user?.organizationId || !session.user.id) {
    redirect("/onboarding");
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.STUDENTS,
    "view",
  );
  if (!allowed) {
    redirect("/dashboard");
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  const [students, openCheckIns, activities] = await Promise.all([
    prisma.student.findMany({
      where: { sessionId: campSession.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        grade: true,
        team: { select: { id: true, name: true, color: true } },
        medicalProfile: {
          select: { allergies: true, medications: true, conditions: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    getOpenCheckInsForSession(campSession.id),
    prisma.activity.findMany({
      where: {
        sessionId: campSession.id,
        startTime: { lte: windowEnd },
        endTime: { gte: windowStart },
      },
      orderBy: { startTime: "asc" },
    }),
  ]);

  return (
    <CheckInFlow
      staffId={session.user.id}
      sessionName={campSession.name}
      students={students}
      activities={activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        location: activity.location,
        startTime: activity.startTime.toISOString(),
        endTime: activity.endTime.toISOString(),
      }))}
      openCheckIns={openCheckIns.map((checkIn) => ({
        ...checkIn,
        checkedInAt: checkIn.checkedInAt.toISOString(),
      }))}
      checkedInCount={openCheckIns.length}
    />
  );
}
