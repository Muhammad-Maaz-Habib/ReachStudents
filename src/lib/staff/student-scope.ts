import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Team IDs the user is assigned to in the given camp session. */
export async function getStaffAssignedTeamIds(
  userId: string,
  sessionId: string,
): Promise<string[]> {
  const assignments = await prisma.teamStaffAssignment.findMany({
    where: {
      userId,
      team: { sessionId },
    },
    select: { teamId: true },
  });
  return assignments.map((row) => row.teamId);
}

/** Mentor group IDs where this user is the assigned mentor. */
export async function getStaffMentoredGroupIds(
  userId: string,
  sessionId: string,
): Promise<string[]> {
  const groups = await prisma.mentorGroup.findMany({
    where: { mentorId: userId, sessionId },
    select: { id: true },
  });
  return groups.map((row) => row.id);
}

/** Club IDs where this user is an advisor. */
export async function getStaffAdvisedClubIds(
  userId: string,
  sessionId: string,
): Promise<string[]> {
  const rows = await prisma.clubAdvisor.findMany({
    where: {
      userId,
      club: { sessionId },
    },
    select: { clubId: true },
  });
  return rows.map((row) => row.clubId);
}

/**
 * Live access via TeamStaffAssignment OR MentorGroup mentorship OR Club advisor
 * (OR, not AND). Does not check role/permission matrix — callers gate those first.
 */
export async function staffHasTeamOrMentorAccess(
  userId: string,
  student: {
    teamId: string | null;
    mentorGroup: { mentorId: string } | null;
    clubMemberships?: { clubId: string }[];
  },
): Promise<boolean> {
  if (student.mentorGroup?.mentorId === userId) {
    return true;
  }

  if (student.teamId) {
    const assignment = await prisma.teamStaffAssignment.findFirst({
      where: { userId, teamId: student.teamId },
      select: { id: true },
    });
    if (assignment) return true;
  }

  const clubIds = (student.clubMemberships ?? []).map((row) => row.clubId);
  if (clubIds.length === 0) {
    return false;
  }

  const advisory = await prisma.clubAdvisor.findFirst({
    where: { userId, clubId: { in: clubIds } },
    select: { id: true },
  });
  return !!advisory;
}

/**
 * Prisma where: students on assigned teams OR mentored groups OR advised clubs.
 * Impossible filter when staff has no connections.
 */
export function studentTeamOrMentorWhere(
  sessionId: string,
  teamIds: string[],
  mentorGroupIds: string[],
  clubIds: string[] = [],
): Prisma.StudentWhereInput {
  if (
    teamIds.length === 0 &&
    mentorGroupIds.length === 0 &&
    clubIds.length === 0
  ) {
    return { sessionId, id: { in: [] } };
  }

  const or: Prisma.StudentWhereInput[] = [];
  if (teamIds.length > 0) {
    or.push({ teamId: { in: teamIds } });
  }
  if (mentorGroupIds.length > 0) {
    or.push({ mentorGroupId: { in: mentorGroupIds } });
  }
  if (clubIds.length > 0) {
    or.push({ clubMemberships: { some: { clubId: { in: clubIds } } } });
  }

  return { sessionId, OR: or };
}
