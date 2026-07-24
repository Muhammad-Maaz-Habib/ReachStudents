import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { getOpenCheckInsForSession } from "@/lib/checkin/server";
import { studentCheckInWhere } from "@/lib/staff/team-access";
import { RollCallFlow } from "@/components/checkin/roll-call-flow";

type RollCallPageProps = {
  searchParams: Promise<{ activityId?: string }>;
};

export default async function ActivityRollCallPage({
  searchParams,
}: RollCallPageProps) {
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

  const params = await searchParams;
  const campSession = await requireOrganizationSession(session.user.organizationId);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const [canCreateActivity, studentWhere] = await Promise.all([
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.SCHEDULES,
      "edit",
    ),
    studentCheckInWhere(session.user.id, session.user.role, campSession.id),
  ]);

  const [students, openCheckIns, activities, teams, mentorGroups] =
    await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        grade: true,
        team: { select: { id: true, name: true, color: true } },
        mentorGroup: { select: { id: true, name: true } },
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
      select: {
        id: true,
        name: true,
        location: true,
        startTime: true,
        endTime: true,
        teamId: true,
        color: true,
        isOpenEnded: true,
      },
    }),
    prisma.team.findMany({
      where: { sessionId: campSession.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.mentorGroup.findMany({
      where: { sessionId: campSession.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <RollCallFlow
      staffId={session.user.id}
      sessionName={campSession.name}
      students={students}
      teams={teams}
      mentorGroups={mentorGroups}
      canCreateActivity={canCreateActivity}
      initialActivityId={params.activityId ?? null}
      activities={activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        location: activity.location,
        startTime: activity.startTime.toISOString(),
        endTime: activity.endTime.toISOString(),
        teamId: activity.teamId,
        color: activity.color,
        isOpenEnded: activity.isOpenEnded,
      }))}
      openCheckIns={openCheckIns.map((checkIn) => ({
        ...checkIn,
        checkedInAt: checkIn.checkedInAt.toISOString(),
      }))}
    />
  );
}
