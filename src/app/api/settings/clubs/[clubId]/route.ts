import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { STAFF_ROLES } from "@/lib/constants";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { clubUpdateSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ clubId: string }> };

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

async function findOrgClub(clubId: string, organizationId: string) {
  return prisma.club.findFirst({
    where: {
      id: clubId,
      session: { organizationId },
    },
  });
}

function shapeClub<T extends {
  memberships: { student: unknown }[];
  advisors: { user: unknown }[];
}>(club: T) {
  return {
    ...club,
    students: club.memberships.map((row) => row.student),
    advisors: club.advisors.map((row) => row.user),
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

  const { clubId } = await context.params;
  const body = await request.json();
  const parsed = clubUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await findOrgClub(clubId, session.user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.name) {
    const duplicate = await prisma.club.findFirst({
      where: {
        sessionId: existing.sessionId,
        id: { not: clubId },
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: `A club named "${duplicate.name}" already exists in this session`,
        },
        { status: 409 },
      );
    }
  }

  if (parsed.data.advisorIds) {
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
  }

  if (parsed.data.studentIds) {
    const count = await prisma.student.count({
      where: {
        id: { in: parsed.data.studentIds },
        sessionId: existing.sessionId,
      },
    });
    if (count !== parsed.data.studentIds.length) {
      return NextResponse.json(
        { error: "One or more students are not in this session" },
        { status: 400 },
      );
    }
  }

  const club = await prisma.$transaction(async (tx) => {
    if (parsed.data.name) {
      await tx.club.update({
        where: { id: clubId },
        data: { name: parsed.data.name.trim() },
      });
    }

    if (parsed.data.advisorIds) {
      const advisorIds = [...new Set(parsed.data.advisorIds)];
      await tx.clubAdvisor.deleteMany({ where: { clubId } });
      await tx.clubAdvisor.createMany({
        data: advisorIds.map((userId) => ({ clubId, userId })),
      });
    }

    if (parsed.data.studentIds) {
      const studentIds = [...new Set(parsed.data.studentIds)];
      await tx.clubMembership.deleteMany({ where: { clubId } });
      if (studentIds.length > 0) {
        await tx.clubMembership.createMany({
          data: studentIds.map((studentId) => ({ clubId, studentId })),
        });
      }
    }

    return tx.club.findUniqueOrThrow({
      where: { id: clubId },
      include: clubInclude,
    });
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "update",
    targetRecord: club.id,
    metadata: { area: "club", name: club.name },
  });

  return NextResponse.json({ club: shapeClub(club) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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

  const { clubId } = await context.params;
  const existing = await findOrgClub(clubId, session.user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.club.delete({ where: { id: clubId } });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "delete",
    targetRecord: clubId,
    metadata: { area: "club", name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
