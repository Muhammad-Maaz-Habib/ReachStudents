import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { mentorGroupUpdateSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ groupId: string }> };

const mentorGroupInclude = {
  mentor: { select: { id: true, name: true, email: true, role: true } },
  students: {
    select: { id: true, firstName: true, lastName: true, teamId: true },
    orderBy: [{ lastName: "asc" as const }, { firstName: "asc" as const }],
  },
  _count: { select: { students: true } },
};

async function findOrgGroup(groupId: string, organizationId: string) {
  return prisma.mentorGroup.findFirst({
    where: {
      id: groupId,
      session: { organizationId },
    },
  });
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

  const { groupId } = await context.params;
  const body = await request.json();
  const parsed = mentorGroupUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await findOrgGroup(groupId, session.user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.name) {
    const duplicate = await prisma.mentorGroup.findFirst({
      where: {
        sessionId: existing.sessionId,
        id: { not: groupId },
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
  }

  if (parsed.data.mentorId) {
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

  const group = await prisma.$transaction(async (tx) => {
    await tx.mentorGroup.update({
      where: { id: groupId },
      data: {
        ...(parsed.data.name !== undefined
          ? { name: parsed.data.name.trim() }
          : {}),
        ...(parsed.data.mentorId !== undefined
          ? { mentorId: parsed.data.mentorId }
          : {}),
      },
    });

    if (parsed.data.studentIds) {
      await tx.student.updateMany({
        where: { mentorGroupId: groupId },
        data: { mentorGroupId: null },
      });
      if (parsed.data.studentIds.length > 0) {
        await tx.student.updateMany({
          where: {
            id: { in: parsed.data.studentIds },
            sessionId: existing.sessionId,
          },
          data: { mentorGroupId: groupId },
        });
      }
    }

    return tx.mentorGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: mentorGroupInclude,
    });
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "update",
    targetRecord: groupId,
    metadata: {
      area: "mentor_group",
      fields: Object.keys(parsed.data),
    },
  });

  return NextResponse.json({ group });
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

  const { groupId } = await context.params;
  const existing = await findOrgGroup(groupId, session.user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.student.updateMany({
      where: { mentorGroupId: groupId },
      data: { mentorGroupId: null },
    });
    await tx.mentorGroup.delete({ where: { id: groupId } });
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "delete",
    targetRecord: groupId,
    metadata: { area: "mentor_group", name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
