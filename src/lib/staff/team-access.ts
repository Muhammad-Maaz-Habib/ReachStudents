import { UserRole } from "@/generated/prisma/client";
import { ADMIN_ROLES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  getStaffAssignedTeamIds,
  getStaffMentoredGroupIds,
  getStaffAdvisedClubIds,
  staffHasTeamOrMentorAccess,
  studentTeamOrMentorWhere,
} from "@/lib/staff/student-scope";

export { getStaffAssignedTeamIds };

/**
 * Can this staff member check in/out a student?
 * Admins / nurses: any student in the org session.
 * Other staff: STUDENTS view + (Team OR MentorGroup OR Club advisor).
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
    select: {
      teamId: true,
      mentorGroup: { select: { mentorId: true } },
      clubMemberships: { select: { clubId: true } },
    },
  });
  if (!student) return false;

  return staffHasTeamOrMentorAccess(userId, student);
}

/** Student where filter for check-in roster — teams OR mentor groups OR clubs. */
export async function studentCheckInWhere(
  userId: string,
  role: UserRole,
  sessionId: string,
): Promise<Prisma.StudentWhereInput> {
  if (ADMIN_ROLES.includes(role) || role === UserRole.NURSE) {
    return { sessionId };
  }

  const [teamIds, mentorGroupIds, clubIds] = await Promise.all([
    getStaffAssignedTeamIds(userId, sessionId),
    getStaffMentoredGroupIds(userId, sessionId),
    getStaffAdvisedClubIds(userId, sessionId),
  ]);

  return studentTeamOrMentorWhere(sessionId, teamIds, mentorGroupIds, clubIds);
}
