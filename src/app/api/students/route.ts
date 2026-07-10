import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireOrganizationSession } from "@/lib/org";
import { createStudentRecord } from "@/lib/student-service";
import { requireStudentAccess, studentInclude } from "@/lib/students";
import { prisma } from "@/lib/prisma";
import { rosterQuerySchema, studentFormSchema } from "@/lib/validations/student";

export async function GET(request: Request) {
  const access = await requireStudentAccess("view");
  if ("error" in access) return access.error;

  const { user } = access;
  const { searchParams } = new URL(request.url);
  const query = rosterQuerySchema.parse({
    q: searchParams.get("q") ?? undefined,
    teamId: searchParams.get("teamId") ?? undefined,
    grade: searchParams.get("grade") ?? undefined,
    hasAllergy: searchParams.get("hasAllergy") ?? undefined,
    staffId: searchParams.get("staffId") ?? undefined,
  });

  const campSession = await requireOrganizationSession(user.organizationId!);

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

  const students = await prisma.student.findMany({
    where,
    include: studentInclude,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({
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
  });
}

export async function POST(request: Request) {
  const access = await requireStudentAccess("edit");
  if ("error" in access) return access.error;

  const { user } = access;
  const body = await request.json();
  const parsed = studentFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const campSession = await requireOrganizationSession(user.organizationId!);
    const student = await createStudentRecord({
      sessionId: campSession.id,
      teams: campSession.teams,
      data: parsed.data,
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create student";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
