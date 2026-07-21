import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { teamUpdateSchema } from "@/lib/validations/settings";
import { normalizeActivityColor } from "@/lib/schedule/activity-colors";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ teamId: string }> };

async function findOrgTeam(teamId: string, organizationId: string) {
  return prisma.team.findFirst({
    where: {
      id: teamId,
      session: { organizationId },
    },
    include: {
      _count: { select: { students: true, staff: true } },
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

  const { teamId } = await context.params;
  const body = await request.json();
  const parsed = teamUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await findOrgTeam(teamId, session.user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.name) {
    const duplicate = await prisma.team.findFirst({
      where: {
        sessionId: existing.sessionId,
        id: { not: teamId },
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `A team named "${duplicate.name}" already exists in this session` },
        { status: 409 },
      );
    }
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.color !== undefined
        ? {
            color:
              parsed.data.color === null
                ? null
                : normalizeActivityColor(parsed.data.color),
          }
        : {}),
    },
    include: {
      students: {
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      },
      staff: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { students: true, staff: true } },
    },
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "update",
    targetRecord: team.id,
    metadata: { area: "team", ...parsed.data },
  });

  return NextResponse.json({ team });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

  const { teamId } = await context.params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const existing = await findOrgTeam(teamId, session.user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing._count.students > 0 && !force) {
    return NextResponse.json(
      {
        error: `Cannot delete "${existing.name}" while ${existing._count.students} student(s) are assigned. Unassign them first, or delete with force=true to clear assignments.`,
        studentCount: existing._count.students,
        staffCount: existing._count.staff,
      },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    if (force && existing._count.students > 0) {
      await tx.student.updateMany({
        where: { teamId },
        data: { teamId: null },
      });
    }
    await tx.team.delete({ where: { id: teamId } });
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "delete",
    targetRecord: teamId,
    metadata: {
      area: "team",
      name: existing.name,
      forced: force,
      studentsUnassigned: force ? existing._count.students : 0,
    },
  });

  return NextResponse.json({ ok: true });
}
