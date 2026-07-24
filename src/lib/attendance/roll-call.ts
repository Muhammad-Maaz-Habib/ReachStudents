import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { WhosHereQuery } from "@/lib/attendance/whos-here";
import { getStudentsOnLeaveNow } from "@/lib/leave/leave-window";

export async function getRollCallData(sessionId: string, query: WhosHereQuery = {}) {
  const studentWhere: Prisma.StudentWhereInput = { sessionId };

  if (query.teamId) {
    studentWhere.teamId = query.teamId;
  }
  if (query.mentorGroupId) {
    studentWhere.mentorGroupId = query.mentorGroupId;
  }

  if (query.q) {
    studentWhere.OR = [
      { firstName: { contains: query.q, mode: "insensitive" } },
      { lastName: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const checkInStudentFilter: Prisma.StudentWhereInput = { sessionId };
  if (query.teamId) checkInStudentFilter.teamId = query.teamId;
  if (query.mentorGroupId) {
    checkInStudentFilter.mentorGroupId = query.mentorGroupId;
  }

  const checkInWhere: Prisma.CheckInWhereInput = {
    checkedOutAt: null,
    student: checkInStudentFilter,
  };

  if (query.activityId === "general") {
    checkInWhere.activityId = null;
  } else if (query.activityId) {
    checkInWhere.activityId = query.activityId;
  }

  const [students, openCheckIns, teams, mentorGroups] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        grade: true,
        team: { select: { id: true, name: true, color: true } },
        mentorGroup: { select: { id: true, name: true } },
        medicalProfile: {
          select: { allergies: true, medications: true, conditions: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.checkIn.findMany({
      where: checkInWhere,
      select: {
        studentId: true,
        checkedInAt: true,
        activity: { select: { name: true, location: true } },
      },
    }),
    prisma.team.findMany({
      where: { sessionId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.mentorGroup.findMany({
      where: { sessionId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const checkInByStudent = new Map(
    openCheckIns.map((checkIn) => [checkIn.studentId, checkIn]),
  );

  const present = students.filter((student) => checkInByStudent.has(student.id));
  const notPresent = students.filter(
    (student) => !checkInByStudent.has(student.id),
  );

  const onLeave = await getStudentsOnLeaveNow(sessionId);
  const onLeaveStudents = notPresent.filter((student) => onLeave.has(student.id));
  const missing = notPresent.filter((student) => !onLeave.has(student.id));

  return {
    totalExpected: students.length,
    presentCount: present.length,
    missingCount: missing.length,
    onLeaveCount: onLeaveStudents.length,
    teams,
    mentorGroups,
    present: present.map((student) => {
      const checkIn = checkInByStudent.get(student.id)!;
      return {
        student,
        checkedInAt: checkIn.checkedInAt,
        activity: checkIn.activity,
        onApprovedLeave: onLeave.has(student.id),
      };
    }),
    missing,
    onLeave: onLeaveStudents,
  };
}
