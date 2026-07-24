import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  GENERAL_LOCATION_KEY,
  UNKNOWN_LOCATION_KEY,
  resolveCampusZone,
} from "@/lib/attendance/location-distribution";
import { getStudentsOnLeaveNow } from "@/lib/leave/leave-window";

export type WhosHereQuery = {
  q?: string;
  teamId?: string;
  mentorGroupId?: string;
  /** Activity id, "general", or "not_checked_in" */
  activityId?: string;
  /**
   * Campus map zone filter: normalized location/activity-name key, or "general".
   * Uses the same latest-open-check-in-per-student rule as the map/donut.
   */
  location?: string;
};

const studentListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  grade: true,
  team: { select: { id: true, name: true, color: true } },
  mentorGroup: { select: { id: true, name: true } },
  medicalProfile: {
    select: { allergies: true, medications: true, conditions: true },
  },
} as const;

function applyStudentFilters(
  base: Prisma.StudentWhereInput,
  query: WhosHereQuery,
): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = { ...base };
  if (query.teamId) where.teamId = query.teamId;
  if (query.mentorGroupId) where.mentorGroupId = query.mentorGroupId;
  if (query.q) {
    where.OR = [
      { firstName: { contains: query.q, mode: "insensitive" } },
      { lastName: { contains: query.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function getWhosHereData(sessionId: string, query: WhosHereQuery = {}) {
  const teamsPromise = prisma.team.findMany({
    where: { sessionId },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  const mentorGroupsPromise = prisma.mentorGroup.findMany({
    where: { sessionId },
    select: { id: true, name: true },
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
    return getWhosHereByLocation(
      sessionId,
      query,
      teamsPromise,
      mentorGroupsPromise,
      activitiesPromise,
    );
  }

  if (query.activityId === "not_checked_in") {
    const openCheckIns = await prisma.checkIn.findMany({
      where: { checkedOutAt: null, student: { sessionId } },
      select: { studentId: true },
    });
    const checkedInIds = [...new Set(openCheckIns.map((row) => row.studentId))];

    const studentWhere = applyStudentFilters(
      {
        sessionId,
        ...(checkedInIds.length > 0 ? { id: { notIn: checkedInIds } } : {}),
      },
      query,
    );

    const [students, teams, mentorGroups, activities, onLeave] =
      await Promise.all([
        prisma.student.findMany({
          where: studentWhere,
          select: studentListSelect,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
        teamsPromise,
        mentorGroupsPromise,
        activitiesPromise,
        getStudentsOnLeaveNow(sessionId),
      ]);

    return {
      total: students.length,
      checkIns: students.map((student) => ({
        id: `not-in-${student.id}`,
        checkedInAt: new Date(0),
        notCheckedIn: true as const,
        onApprovedLeave: onLeave.has(student.id),
        student,
        activity: null,
      })),
      teams,
      mentorGroups,
      activities,
    };
  }
  const where: Prisma.CheckInWhereInput = {
    checkedOutAt: null,
    student: applyStudentFilters({ sessionId }, query),
  };

  if (query.activityId === "general") {
    where.activityId = null;
  } else if (query.activityId) {
    where.activityId = query.activityId;
  }

  const [openCheckIns, teams, mentorGroups, activities] = await Promise.all([
    prisma.checkIn.findMany({
      where,
      include: {
        student: { select: studentListSelect },
        activity: { select: { id: true, name: true, location: true } },
      },
      orderBy: [{ checkedInAt: "desc" }],
    }),
    teamsPromise,
    mentorGroupsPromise,
    activitiesPromise,
  ]);

  return {
    total: openCheckIns.length,
    checkIns: openCheckIns.map((checkIn) => ({
      ...checkIn,
      notCheckedIn: false as const,
    })),
    teams,
    mentorGroups,
    activities,
  };
}

async function getWhosHereByLocation(
  sessionId: string,
  query: WhosHereQuery,
  teamsPromise: Promise<{ id: string; name: string; color: string | null }[]>,
  mentorGroupsPromise: Promise<{ id: string; name: string }[]>,
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
          ...studentListSelect,
          teamId: true,
          mentorGroupId: true,
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
    const zone = resolveCampusZone(checkIn.activity);
    if (
      locationKey === GENERAL_LOCATION_KEY ||
      locationKey === UNKNOWN_LOCATION_KEY
    ) {
      return zone.key === GENERAL_LOCATION_KEY;
    }
    return zone.key === locationKey.toLowerCase();
  });

  if (query.teamId) {
    matched = matched.filter((checkIn) => checkIn.student.teamId === query.teamId);
  }

  if (query.mentorGroupId) {
    matched = matched.filter(
      (checkIn) => checkIn.student.mentorGroupId === query.mentorGroupId,
    );
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

  const [teams, mentorGroups, activities] = await Promise.all([
    teamsPromise,
    mentorGroupsPromise,
    activitiesPromise,
  ]);

  return {
    total: matched.length,
    checkIns: matched.map((checkIn) => ({
      ...checkIn,
      notCheckedIn: false as const,
    })),
    teams,
    mentorGroups,
    activities,
  };
}
