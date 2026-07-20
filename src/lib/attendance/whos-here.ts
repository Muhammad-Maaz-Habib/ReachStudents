import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type WhosHereQuery = {
  q?: string;
  teamId?: string;
  /** Activity id, "general", or "not_checked_in" */
  activityId?: string;
};

export async function getWhosHereData(sessionId: string, query: WhosHereQuery = {}) {
  const teamsPromise = prisma.team.findMany({
    where: { sessionId },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  const activitiesPromise = prisma.activity.findMany({
    where: {
      sessionId,
      endTime: { gte: new Date() },
    },
    select: { id: true, name: true, startTime: true, location: true },
    orderBy: { startTime: "asc" },
    take: 50,
  });

  if (query.activityId === "not_checked_in") {
    const openCheckIns = await prisma.checkIn.findMany({
      where: { checkedOutAt: null, student: { sessionId } },
      select: { studentId: true },
    });
    const checkedInIds = [...new Set(openCheckIns.map((row) => row.studentId))];

    const studentWhere: Prisma.StudentWhereInput = {
      sessionId,
      ...(checkedInIds.length > 0 ? { id: { notIn: checkedInIds } } : {}),
    };

    if (query.teamId) {
      studentWhere.teamId = query.teamId;
    }
    if (query.q) {
      studentWhere.OR = [
        { firstName: { contains: query.q, mode: "insensitive" } },
        { lastName: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [students, teams, activities] = await Promise.all([
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
      teamsPromise,
      activitiesPromise,
    ]);

    return {
      total: students.length,
      checkIns: students.map((student) => ({
        id: `not-in-${student.id}`,
        checkedInAt: new Date(0),
        notCheckedIn: true as const,
        student,
        activity: null,
      })),
      teams,
      activities,
    };
  }

  const where: Prisma.CheckInWhereInput = {
    checkedOutAt: null,
    student: { sessionId },
  };

  if (query.activityId === "general") {
    where.activityId = null;
  } else if (query.activityId) {
    where.activityId = query.activityId;
  }

  const andConditions: Prisma.CheckInWhereInput[] = [];

  if (query.q) {
    andConditions.push({
      student: {
        OR: [
          { firstName: { contains: query.q, mode: "insensitive" } },
          { lastName: { contains: query.q, mode: "insensitive" } },
        ],
      },
    });
  }

  if (query.teamId) {
    andConditions.push({
      student: { teamId: query.teamId },
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const [openCheckIns, teams, activities] = await Promise.all([
    prisma.checkIn.findMany({
      where,
      include: {
        student: {
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
        },
        activity: { select: { id: true, name: true, location: true } },
      },
      orderBy: [{ checkedInAt: "desc" }],
    }),
    teamsPromise,
    activitiesPromise,
  ]);

  return {
    total: openCheckIns.length,
    checkIns: openCheckIns.map((checkIn) => ({
      ...checkIn,
      notCheckedIn: false as const,
    })),
    teams,
    activities,
  };
}
