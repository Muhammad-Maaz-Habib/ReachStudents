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

/**
 * Live access via TeamStaffAssignment OR MentorGroup mentorship (OR, not AND).
 * Does not check role/permission matrix — callers gate those first.
 */
export async function staffHasTeamOrMentorAccess(
  userId: string,
  student: {
    teamId: string | null;
    mentorGroup: { mentorId: string } | null;
  },
): Promise<boolean> {
  if (student.mentorGroup?.mentorId === userId) {
    return true;
  }

  if (!student.teamId) {
    return false;
  }

  const assignment = await prisma.teamStaffAssignment.findFirst({
    where: { userId, teamId: student.teamId },
    select: { id: true },
  });
  return !!assignment;
}

/**
 * Prisma where clause: students on assigned teams OR in mentored groups.
 * Returns an impossible filter when the staff has neither connection.
 */
export function studentTeamOrMentorWhere(
  sessionId: string,
  teamIds: string[],
  mentorGroupIds: string[],
): Prisma.StudentWhereInput {
  if (teamIds.length === 0 && mentorGroupIds.length === 0) {
    return { sessionId, id: { in: [] } };
  }

  const or: Prisma.StudentWhereInput[] = [];
  if (teamIds.length > 0) {
    or.push({ teamId: { in: teamIds } });
  }
  if (mentorGroupIds.length > 0) {
    or.push({ mentorGroupId: { in: mentorGroupIds } });
  }

  return { sessionId, OR: or };
}
