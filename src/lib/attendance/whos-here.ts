import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { UNKNOWN_LOCATION_KEY } from "@/lib/attendance/location-distribution";

export type WhosHereQuery = {
  q?: string;
  teamId?: string;
  /** Activity id, "general", or "not_checked_in" */
  activityId?: string;
  /**
   * Campus map zone filter: normalized location key, or UNKNOWN_LOCATION_KEY.
   * Uses the same latest-open-check-in-per-student rule as the map/donut.
   */
  location?: string;
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

  if (query.location) {
    return getWhosHereByLocation(sessionId, query, teamsPromise, activitiesPromise);
  }

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

async function getWhosHereByLocation(
  sessionId: string,
  query: WhosHereQuery,
  teamsPromise: Promise<{ id: string; name: string; color: string | null }[]>,
  activitiesPromise: Promise<
    { id: string; name: string; startTime: Date; location: string | null }[]
  >,
) {
  const locationKey = query.location!;
  const openCheckIns = await prisma.checkIn.findMany({
    where: {
      checkedOutAt: null,
      student: { sessionId },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          grade: true,
          teamId: true,
          team: { select: { id: true, name: true, color: true } },
          medicalProfile: {
            select: { allergies: true, medications: true, conditions: true },
          },
        },
      },
      activity: { select: { id: true, name: true, location: true } },
    },
    orderBy: { checkedInAt: "desc" },
  });

  const latestByStudent = new Map<string, (typeof openCheckIns)[number]>();
  for (const checkIn of openCheckIns) {
    if (!latestByStudent.has(checkIn.studentId)) {
      latestByStudent.set(checkIn.studentId, checkIn);
    }
  }

  let matched = [...latestByStudent.values()].filter((checkIn) => {
    const raw = checkIn.activity?.location?.trim() ?? "";
    if (locationKey === UNKNOWN_LOCATION_KEY) {
      return !raw;
    }
    return raw.toLowerCase() === locationKey.toLowerCase();
  });

  if (query.teamId) {
    matched = matched.filter((checkIn) => checkIn.student.teamId === query.teamId);
  }

  if (query.q) {
    const q = query.q.toLowerCase();
    matched = matched.filter((checkIn) => {
      const name =
        `${checkIn.student.firstName} ${checkIn.student.lastName}`.toLowerCase();
      return name.includes(q);
    });
  }

  matched.sort((a, b) => {
    const last = a.student.lastName.localeCompare(b.student.lastName);
    if (last !== 0) return last;
    return a.student.firstName.localeCompare(b.student.firstName);
  });

  const [teams, activities] = await Promise.all([teamsPromise, activitiesPromise]);

  return {
    total: matched.length,
    checkIns: matched.map((checkIn) => ({
      ...checkIn,
      notCheckedIn: false as const,
    })),
    teams,
    activities,
  };
}
