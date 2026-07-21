import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { campSessionUpdateSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ sessionId: string }> };

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

  const { sessionId } = await context.params;
  const body = await request.json();
  const parsed = campSessionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.campSession.findFirst({
    where: {
      id: sessionId,
      organizationId: session.user.organizationId,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const startDate = parsed.data.startDate
    ? new Date(parsed.data.startDate)
    : existing.startDate;
  const endDate = parsed.data.endDate
    ? new Date(parsed.data.endDate)
    : existing.endDate;
  if (!(endDate > startDate)) {
    return NextResponse.json(
      { error: "End date must be after start date" },
      { status: 400 },
    );
  }

  const campSession = await prisma.$transaction(async (tx) => {
    if (parsed.data.isActive === true) {
      await tx.campSession.updateMany({
        where: {
          organizationId: session.user.organizationId!,
          isActive: true,
          NOT: { id: sessionId },
        },
        data: { isActive: false },
      });
    }

    return tx.campSession.update({
      where: { id: sessionId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
        ...(parsed.data.startDate !== undefined ? { startDate } : {}),
        ...(parsed.data.endDate !== undefined ? { endDate } : {}),
        ...(parsed.data.isActive !== undefined
          ? {
              isActive: parsed.data.isActive,
              archivedAt: parsed.data.isActive ? null : existing.archivedAt,
            }
          : {}),
      },
      include: { _count: { select: { teams: true, students: true } } },
    });
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "update",
    targetRecord: campSession.id,
    metadata: { area: "session", ...parsed.data },
  });

  return NextResponse.json({ session: campSession });
}
