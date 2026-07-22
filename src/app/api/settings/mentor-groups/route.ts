import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { STAFF_ROLES } from "@/lib/constants";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { mentorGroupCreateSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

const mentorGroupInclude = {
  mentor: { select: { id: true, name: true, email: true, role: true } },
  students: {
    select: { id: true, firstName: true, lastName: true, teamId: true },
    orderBy: [{ lastName: "asc" as const }, { firstName: "asc" as const }],
  },
  _count: { select: { students: true } },
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SETTINGS,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  const campSession = sessionId
    ? await prisma.campSession.findFirst({
        where: {
          id: sessionId,
          organizationId: session.user.organizationId,
        },
      })
    : await prisma.campSession.findFirst({
        where: {
          organizationId: session.user.organizationId,
          isActive: true,
        },
        orderBy: { startDate: "desc" },
      });

  if (!campSession) {
    return NextResponse.json({ error: "No session found" }, { status: 404 });
  }

  const [groups, staff, students] = await Promise.all([
    prisma.mentorGroup.findMany({
      where: { sessionId: campSession.id },
      include: mentorGroupInclude,
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
        role: { in: STAFF_ROLES },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: { sessionId: campSession.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mentorGroupId: true,
        team: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  return NextResponse.json({
    session: campSession,
    groups,
    staffOptions: staff,
    studentOptions: students,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SETTINGS,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = mentorGroupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campSession = await prisma.campSession.findFirst({
    where: {
      id: parsed.data.sessionId,
      organizationId: session.user.organizationId,
    },
  });
  if (!campSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const mentor = await prisma.user.findFirst({
    where: {
      id: parsed.data.mentorId,
      organizationId: session.user.organizationId,
      isActive: true,
    },
  });
  if (!mentor) {
    return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
  }

  const duplicate = await prisma.mentorGroup.findFirst({
    where: {
      sessionId: campSession.id,
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
  });
  if (duplicate) {
    return NextResponse.json(
      {
        error: `A mentor group named "${duplicate.name}" already exists in this session`,
      },
      { status: 409 },
    );
  }

  const studentIds = parsed.data.studentIds ?? [];
  if (studentIds.length > 0) {
    const count = await prisma.student.count({
      where: { id: { in: studentIds }, sessionId: campSession.id },
    });
    if (count !== studentIds.length) {
      return NextResponse.json(
        { error: "One or more students are not in this session" },
        { status: 400 },
      );
    }
  }

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.mentorGroup.create({
      data: {
        sessionId: campSession.id,
        name: parsed.data.name.trim(),
        mentorId: mentor.id,
      },
    });

    if (studentIds.length > 0) {
      await tx.student.updateMany({
        where: { id: { in: studentIds }, sessionId: campSession.id },
        data: { mentorGroupId: created.id },
      });
    }

    return tx.mentorGroup.findUniqueOrThrow({
      where: { id: created.id },
      include: mentorGroupInclude,
    });
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "create",
    targetRecord: group.id,
    metadata: {
      area: "mentor_group",
      name: group.name,
      mentorId: mentor.id,
      studentCount: studentIds.length,
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}
