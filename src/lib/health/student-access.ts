import { UserRole } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.SESSION_ADMIN];

export async function canAccessStudentHealth(
  userId: string,
  role: UserRole,
  organizationId: string,
  studentId: string,
  action: "view" | "edit",
): Promise<boolean> {
  const resource =
    role === UserRole.STAFF && action === "view"
      ? PermissionResource.STUDENTS
      : PermissionResource.HEALTH_RECORDS;

  const allowed = await hasPermission(organizationId, role, resource, action);
  if (!allowed && role !== UserRole.NURSE) return false;
  if (role === UserRole.NURSE) {
    const nurseAllowed = await hasPermission(
      organizationId,
      role,
      PermissionResource.HEALTH_RECORDS,
      action === "edit" ? "edit" : "view",
    );
    if (!nurseAllowed) return false;
  }

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

export async function canFileIncidentForStudent(
  userId: string,
  role: UserRole,
  organizationId: string,
  studentId: string,
): Promise<boolean> {
  const allowed = await hasPermission(
    organizationId,
    role,
    PermissionResource.INCIDENTS,
    "edit",
  );
  if (!allowed) return false;

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
