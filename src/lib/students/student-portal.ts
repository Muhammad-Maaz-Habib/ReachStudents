import { UserRole } from "@/generated/prisma/client";
import { ADMIN_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type StudentMessageContact = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  reason: "admin" | "mentor" | "team_staff";
};

/**
 * Staff a student may message: Session/Super admins, mentor-group mentor,
 * and staff assigned to the student's team. No peers / no directory of all staff.
 */
export async function getStudentAllowedStaffContacts(
  organizationId: string,
  studentId: string,
): Promise<StudentMessageContact[]> {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      session: { organizationId },
    },
    select: {
      teamId: true,
      mentorGroup: { select: { mentorId: true } },
    },
  });
  if (!student) return [];

  const contacts = new Map<string, StudentMessageContact>();

  const admins = await prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      role: { in: ADMIN_ROLES },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  for (const admin of admins) {
    contacts.set(admin.id, { ...admin, reason: "admin" });
  }

  if (student.mentorGroup?.mentorId) {
    const mentor = await prisma.user.findFirst({
      where: {
        id: student.mentorGroup.mentorId,
        organizationId,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    if (mentor) {
      contacts.set(mentor.id, {
        ...mentor,
        reason: contacts.has(mentor.id) ? "admin" : "mentor",
      });
    }
  }

  if (student.teamId) {
    const assignments = await prisma.teamStaffAssignment.findMany({
      where: { teamId: student.teamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            organizationId: true,
          },
        },
      },
    });
    for (const row of assignments) {
      if (
        !row.user.isActive ||
        row.user.organizationId !== organizationId ||
        row.user.role === UserRole.STUDENT ||
        row.user.role === UserRole.PARENT
      ) {
        continue;
      }
      if (!contacts.has(row.user.id)) {
        contacts.set(row.user.id, {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          role: row.user.role,
          reason: "team_staff",
        });
      }
    }
  }

  return [...contacts.values()].sort((a, b) =>
    (a.name ?? a.email).localeCompare(b.name ?? b.email),
  );
}

export async function staffCanAccessStudentStaffThread(
  userId: string,
  role: UserRole,
  organizationId: string,
  studentId: string,
): Promise<boolean> {
  if (ADMIN_ROLES.includes(role)) return true;

  const contacts = await getStudentAllowedStaffContacts(
    organizationId,
    studentId,
  );
  return contacts.some((contact) => contact.id === userId);
}

export async function getStudentScheduleItems(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, teamId: true, sessionId: true },
  });
  if (!student) return [];

  const schedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { studentId: student.id },
        ...(student.teamId ? [{ teamId: student.teamId }] : []),
      ],
      activity: { sessionId: student.sessionId },
    },
    include: {
      activity: {
        select: {
          id: true,
          name: true,
          description: true,
          location: true,
          startTime: true,
          endTime: true,
          isOpenEnded: true,
        },
      },
    },
    orderBy: { activity: { startTime: "asc" } },
  });

  // De-dupe if both student + team schedules point at the same activity
  const seen = new Set<string>();
  const items = [];
  for (const row of schedules) {
    if (seen.has(row.activity.id)) continue;
    seen.add(row.activity.id);
    items.push(row.activity);
  }
  return items;
}
