import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type WhosHereQuery = {
  q?: string;
  teamId?: string;
  activityId?: string;
};

export async function getWhosHereData(sessionId: string, query: WhosHereQuery = {}) {
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
    prisma.team.findMany({
      where: { sessionId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.activity.findMany({
      where: {
        sessionId,
        endTime: { gte: new Date() },
      },
      select: { id: true, name: true, startTime: true, location: true },
      orderBy: { startTime: "asc" },
      take: 50,
    }),
  ]);

  return {
    total: openCheckIns.length,
    checkIns: openCheckIns,
    teams,
    activities,
  };
}
