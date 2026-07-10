import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrganizationSession } from "@/lib/org";
import { studentInclude } from "@/lib/students";
import type { RosterQuery } from "@/lib/validations/student";

export async function getRosterData(
  organizationId: string,
  query: RosterQuery = {},
) {
  const campSession = await requireOrganizationSession(organizationId);

  const where: Prisma.StudentWhereInput = {
    sessionId: campSession.id,
  };

  const andConditions: Prisma.StudentWhereInput[] = [];

  if (query.q) {
    andConditions.push({
      OR: [
        { firstName: { contains: query.q, mode: "insensitive" } },
        { lastName: { contains: query.q, mode: "insensitive" } },
        { guardianName: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }

  if (query.teamId) {
    where.teamId = query.teamId;
  }

  if (query.grade) {
    where.grade = query.grade;
  }

  if (query.hasAllergy === "true") {
    andConditions.push({
      medicalProfile: {
        allergies: { not: null },
        NOT: { allergies: "" },
      },
    });
  }

  if (query.hasAllergy === "false") {
    andConditions.push({
      OR: [
        { medicalProfile: null },
        { medicalProfile: { allergies: null } },
        { medicalProfile: { allergies: "" } },
      ],
    });
  }

  if (query.staffId) {
    where.team = {
      staff: {
        some: { userId: query.staffId },
      },
    };
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const [students, staffUsers, gradeRows] = await Promise.all([
    prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ["STAFF", "SESSION_ADMIN", "NURSE", "SUPER_ADMIN"] },
        isActive: true,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: { sessionId: campSession.id, grade: { not: null } },
      select: { grade: true },
      distinct: ["grade"],
      orderBy: { grade: "asc" },
    }),
  ]);

  const grades = gradeRows
    .map((row) => row.grade)
    .filter((grade): grade is string => !!grade);

  return {
    session: {
      id: campSession.id,
      name: campSession.name,
    },
    teams: campSession.teams.map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      staff: team.staff.map((assignment) => assignment.user),
    })),
    students,
    staffUsers,
    grades,
  };
}
