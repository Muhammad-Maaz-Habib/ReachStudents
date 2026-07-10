import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";

type RouteContext = { params: Promise<{ activityId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SCHEDULES,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { activityId } = await context.params;
  const campSession = await requireOrganizationSession(session.user.organizationId);
  const body = await request.json();

  const existing = await prisma.activity.findFirst({
    where: { id: activityId, sessionId: campSession.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      ...(body.startTime ? { startTime: new Date(body.startTime) } : {}),
      ...(body.endTime ? { endTime: new Date(body.endTime) } : {}),
      ...(body.overdueAlertMinutes !== undefined
        ? { overdueAlertMinutes: Number(body.overdueAlertMinutes) }
        : {}),
      ...(body.name ? { name: body.name } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
    },
  });

  return NextResponse.json({ activity });
}
