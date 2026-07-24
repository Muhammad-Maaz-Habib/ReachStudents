import { prisma } from "@/lib/prisma";
import { getApprovedLeaveStudentIds } from "@/lib/leave/leave-window";

export type MissingStudentAlert = {
  activityId: string;
  activityName: string;
  location: string | null;
  startTime: Date;
  overdueMinutes: number;
  thresholdMinutes: number;
  students: {
    id: string;
    firstName: string;
    lastName: string;
    teamName: string | null;
  }[];
};

export async function getMissingStudentAlerts(
  sessionId: string,
  now = new Date(),
): Promise<MissingStudentAlert[]> {
  const activities = await prisma.activity.findMany({
    where: {
      sessionId,
      startTime: { lte: now },
      endTime: { gte: now },
    },
    include: {
      schedules: true,
      checkIns: {
        where: {
          checkedInAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        select: { studentId: true, checkedInAt: true, activityId: true },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const alerts: MissingStudentAlert[] = [];

  for (const activity of activities) {
    const thresholdMs = activity.overdueAlertMinutes * 60 * 1000;
    const alertAfter = new Date(activity.startTime.getTime() + thresholdMs);
    if (now < alertAfter) continue;

    const expectedStudentIds = new Set<string>();

    for (const schedule of activity.schedules) {
      if (schedule.studentId) {
        expectedStudentIds.add(schedule.studentId);
      }
      if (schedule.teamId) {
        const teamStudents = await prisma.student.findMany({
          where: { teamId: schedule.teamId, sessionId },
          select: { id: true },
        });
        teamStudents.forEach((student) => expectedStudentIds.add(student.id));
      }
    }

    // If activity has teamId but no schedules, expect whole team
    if (activity.teamId && activity.schedules.length === 0) {
      const teamStudents = await prisma.student.findMany({
        where: { teamId: activity.teamId, sessionId },
        select: { id: true },
      });
      teamStudents.forEach((student) => expectedStudentIds.add(student.id));
    }

    if (expectedStudentIds.size === 0) continue;

    const checkedInIds = new Set(
      activity.checkIns
        .filter(
          (checkIn) =>
            checkIn.activityId === activity.id &&
            checkIn.checkedInAt >= activity.startTime,
        )
        .map((checkIn) => checkIn.studentId),
    );

    const missingIds = [...expectedStudentIds].filter(
      (id) => !checkedInIds.has(id),
    );

    if (missingIds.length === 0) continue;

    const onLeave = await getApprovedLeaveStudentIds({
      sessionId,
      rangeStart: activity.startTime,
      rangeEnd: activity.endTime,
      activityId: activity.id,
    });

    const alertIds = missingIds.filter((id) => !onLeave.has(id));
    if (alertIds.length === 0) continue;

    const students = await prisma.student.findMany({
      where: { id: { in: alertIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        team: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    alerts.push({
      activityId: activity.id,
      activityName: activity.name,
      location: activity.location,
      startTime: activity.startTime,
      overdueMinutes: Math.floor(
        (now.getTime() - activity.startTime.getTime()) / 60000,
      ),
      thresholdMinutes: activity.overdueAlertMinutes,
      students: students.map((student) => ({
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        teamName: student.team?.name ?? null,
      })),
    });
  }

  return alerts;
}

export async function getMissingStudentCount(sessionId: string) {
  const alerts = await getMissingStudentAlerts(sessionId);
  return alerts.reduce((sum, alert) => sum + alert.students.length, 0);
}
