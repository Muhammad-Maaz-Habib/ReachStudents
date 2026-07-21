import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { getOpenCheckInsForSession } from "@/lib/checkin/server";
import { studentCheckInWhere } from "@/lib/staff/team-access";
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

  const [canCreateActivity, studentWhere] = await Promise.all([
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.SCHEDULES,
      "edit",
    ),
    studentCheckInWhere(session.user.id, session.user.role, campSession.id),
  ]);

  const [students, openCheckIns, activities, teams] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
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
    prisma.team.findMany({
      where: { sessionId: campSession.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <CheckInFlow
      staffId={session.user.id}
      sessionName={campSession.name}
      students={students}
      teams={teams}
      canCreateActivity={canCreateActivity}
      activities={activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        location: activity.location,
        startTime: activity.startTime.toISOString(),
        endTime: activity.endTime.toISOString(),
        color: activity.color,
        isOpenEnded: activity.isOpenEnded,
      }))}
      openCheckIns={openCheckIns.map((checkIn) => ({
        ...checkIn,
        checkedInAt: checkIn.checkedInAt.toISOString(),
      }))}
      checkedInCount={openCheckIns.length}
    />
  );
}
