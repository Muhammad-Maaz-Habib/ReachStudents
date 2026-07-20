import { UserRole } from "@/generated/prisma/client";
import { ADMIN_ROLES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

/** Team IDs the user is assigned to in the given camp session (empty = none). */
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

/**
 * Can this staff member check in/out a student?
 * Admins / nurses: any student in the org session.
 * Other staff: must have STUDENTS view + TeamStaffAssignment on the student's team.
 * Access is evaluated live from DB — no re-login required after assignment changes.
 */
export async function canCheckInStudent(
  userId: string,
  role: UserRole,
  organizationId: string,
  studentId: string,
): Promise<boolean> {
  const canView = await hasPermission(
    organizationId,
    role,
    PermissionResource.STUDENTS,
    "view",
  );
  if (!canView) return false;

  if (ADMIN_ROLES.includes(role) || role === UserRole.NURSE) {
    const student = await prisma.student.findFirst({
      where: { id: studentId, session: { organizationId } },
      select: { id: true },
    });
    return !!student;
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, session: { organizationId } },
    select: { teamId: true },
  });
  if (!student?.teamId) return false;

  const assignment = await prisma.teamStaffAssignment.findFirst({
    where: { userId, teamId: student.teamId },
    select: { id: true },
  });
  return !!assignment;
}

/** Student where filter for check-in roster — scoped to assigned teams for non-admin staff. */
export async function studentCheckInWhere(
  userId: string,
  role: UserRole,
  sessionId: string,
): Promise<{ sessionId: string; teamId?: { in: string[] } }> {
  if (ADMIN_ROLES.includes(role) || role === UserRole.NURSE) {
    return { sessionId };
  }

  const teamIds = await getStaffAssignedTeamIds(userId, sessionId);
  if (teamIds.length === 0) {
    return { sessionId, teamId: { in: [] as string[] } };
  }
  return {
    sessionId,
    teamId: { in: teamIds },
  };
}
