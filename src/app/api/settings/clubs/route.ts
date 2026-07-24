import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { STAFF_ROLES } from "@/lib/constants";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { clubCreateSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

const clubInclude = {
  advisors: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  memberships: {
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          teamId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  _count: { select: { memberships: true, advisors: true } },
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

  const [clubs, staff, students] = await Promise.all([
    prisma.club.findMany({
      where: { sessionId: campSession.id },
      include: clubInclude,
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
        team: { select: { name: true } },
        clubMemberships: { select: { clubId: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  return NextResponse.json({
    session: campSession,
    clubs: clubs.map((club) => ({
      ...club,
      students: club.memberships.map((row) => row.student),
      advisors: club.advisors.map((row) => row.user),
    })),
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
  const parsed = clubCreateSchema.safeParse(body);
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

  const advisorIds = [...new Set(parsed.data.advisorIds)];
  const advisors = await prisma.user.findMany({
    where: {
      id: { in: advisorIds },
      organizationId: session.user.organizationId,
      isActive: true,
      role: { in: STAFF_ROLES },
    },
    select: { id: true },
  });
  if (advisors.length !== advisorIds.length) {
    return NextResponse.json(
      { error: "One or more advisors are invalid or inactive staff" },
      { status: 400 },
    );
  }

  const duplicate = await prisma.club.findFirst({
    where: {
      sessionId: campSession.id,
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `A club named "${duplicate.name}" already exists in this session` },
      { status: 409 },
    );
  }

  const studentIds = [...new Set(parsed.data.studentIds ?? [])];
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

  const club = await prisma.$transaction(async (tx) => {
    const created = await tx.club.create({
      data: {
        sessionId: campSession.id,
        name: parsed.data.name.trim(),
        advisors: {
          create: advisorIds.map((userId) => ({ userId })),
        },
        memberships: {
          create: studentIds.map((studentId) => ({ studentId })),
        },
      },
      include: clubInclude,
    });
    return created;
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "create",
    targetRecord: club.id,
    metadata: { area: "club", name: club.name },
  });

  return NextResponse.json({
    club: {
      ...club,
      students: club.memberships.map((row) => row.student),
      advisors: club.advisors.map((row) => row.user),
    },
  });
}
