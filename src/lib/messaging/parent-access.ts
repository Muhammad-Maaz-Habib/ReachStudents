import { UserRole } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import {
  getStaffAssignedTeamIds,
  getStaffMentoredGroupIds,
  getStaffAdvisedClubIds,
  staffHasTeamOrMentorAccess,
  studentTeamOrMentorWhere,
} from "@/lib/staff/student-scope";

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.SESSION_ADMIN];

export async function canAccessStudentMessaging(
  userId: string,
  role: UserRole,
  organizationId: string,
  studentId: string,
): Promise<boolean> {
  if (role === UserRole.PARENT) {
    const link = await prisma.studentParent.findFirst({
      where: { userId, studentId },
      select: { id: true },
    });
    return !!link;
  }

  if (ADMIN_ROLES.includes(role)) {
    return hasPermission(organizationId, role, PermissionResource.MESSAGING, "view");
  }

  const canMessage = await hasPermission(
    organizationId,
    role,
    PermissionResource.MESSAGING,
    "view",
  );
  if (!canMessage) return false;

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      session: { organizationId },
    },
    select: {
      teamId: true,
      mentorGroup: { select: { mentorId: true } },
      clubMemberships: { select: { clubId: true } },
    },
  });
  if (!student) return false;

  return staffHasTeamOrMentorAccess(userId, student);
}

export async function getAccessibleStudentIdsForStaff(
  userId: string,
  role: UserRole,
  organizationId: string,
  sessionId: string,
): Promise<string[] | "all"> {
  if (role === UserRole.PARENT) {
    const links = await prisma.studentParent.findMany({
      where: {
        userId,
        student: { sessionId },
      },
      select: { studentId: true },
    });
    return links.map((link) => link.studentId);
  }

  if (ADMIN_ROLES.includes(role)) {
    return "all";
  }

  const canMessage = await hasPermission(
    organizationId,
    role,
    PermissionResource.MESSAGING,
    "view",
  );
  if (!canMessage) return [];

  const [teamIds, mentorGroupIds, clubIds] = await Promise.all([
    getStaffAssignedTeamIds(userId, sessionId),
    getStaffMentoredGroupIds(userId, sessionId),
    getStaffAdvisedClubIds(userId, sessionId),
  ]);

  const students = await prisma.student.findMany({
    where: studentTeamOrMentorWhere(sessionId, teamIds, mentorGroupIds, clubIds),
    select: { id: true },
  });
  return students.map((student) => student.id);
}
