import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { excursionUpdateSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ excursionId: string }> };

function shapeExcursion<T extends { startTime: Date; endTime: Date }>(
  excursion: T,
) {
  return {
    ...excursion,
    startTime: excursion.startTime.toISOString(),
    endTime: excursion.endTime.toISOString(),
  };
}

async function findOrgExcursion(excursionId: string, organizationId: string) {
  return prisma.excursion.findFirst({
    where: {
      id: excursionId,
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

  const { excursionId } = await context.params;
  const body = await request.json();
  const parsed = excursionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await findOrgExcursion(
    excursionId,
    session.user.organizationId,
  );
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.name) {
    const duplicate = await prisma.excursion.findFirst({
      where: {
        sessionId: existing.sessionId,
        id: { not: excursionId },
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: `An excursion named "${duplicate.name}" already exists in this session`,
        },
        { status: 409 },
      );
    }
  }

  const nextStart = parsed.data.startTime
    ? new Date(parsed.data.startTime)
    : existing.startTime;
  const nextEnd = parsed.data.endTime
    ? new Date(parsed.data.endTime)
    : existing.endTime;
  if (nextEnd <= nextStart) {
    return NextResponse.json(
      { error: "End must be after start" },
      { status: 400 },
    );
  }

  const excursion = await prisma.excursion.update({
    where: { id: excursionId },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.destination !== undefined
        ? { destination: parsed.data.destination }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.capacity !== undefined
        ? { capacity: parsed.data.capacity }
        : {}),
      ...(parsed.data.startTime
        ? { startTime: new Date(parsed.data.startTime) }
        : {}),
      ...(parsed.data.endTime ? { endTime: new Date(parsed.data.endTime) } : {}),
    },
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "update",
    targetRecord: excursion.id,
    metadata: { area: "excursion", name: excursion.name },
  });

  return NextResponse.json({ excursion: shapeExcursion(excursion) });
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

  const { excursionId } = await context.params;
  const existing = await findOrgExcursion(
    excursionId,
    session.user.organizationId,
  );
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.excursion.delete({ where: { id: excursionId } });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "delete",
    targetRecord: excursionId,
    metadata: { area: "excursion", name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
