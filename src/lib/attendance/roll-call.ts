import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { WhosHereQuery } from "@/lib/attendance/whos-here";

export async function getRollCallData(sessionId: string, query: WhosHereQuery = {}) {
  const studentWhere: Prisma.StudentWhereInput = { sessionId };

  if (query.teamId) {
    studentWhere.teamId = query.teamId;
  }

  if (query.q) {
    studentWhere.OR = [
      { firstName: { contains: query.q, mode: "insensitive" } },
      { lastName: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const checkInWhere: Prisma.CheckInWhereInput = {
    checkedOutAt: null,
    student: { sessionId },
  };

  if (query.teamId) {
    checkInWhere.student = { sessionId, teamId: query.teamId };
  }

  if (query.activityId === "general") {
    checkInWhere.activityId = null;
  } else if (query.activityId) {
    checkInWhere.activityId = query.activityId;
  }

  const [students, openCheckIns, teams] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
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
  ]);

  const checkInByStudent = new Map(
    openCheckIns.map((checkIn) => [checkIn.studentId, checkIn]),
  );

  const present = students.filter((student) => checkInByStudent.has(student.id));
  const missing = students.filter((student) => !checkInByStudent.has(student.id));

  return {
    totalExpected: students.length,
    presentCount: present.length,
    missingCount: missing.length,
    teams,
    present: present.map((student) => {
      const checkIn = checkInByStudent.get(student.id)!;
      return {
        student,
        checkedInAt: checkIn.checkedInAt,
        activity: checkIn.activity,
      };
    }),
    missing,
  };
}
