import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { normalizeActivityColor } from "@/lib/schedule/activity-colors";
import {
  deleteActivities,
  getActivityDeleteImpact,
} from "@/lib/schedule/activities";
import type { ActivityDeleteScope } from "@/lib/schedule/activity-delete";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";
import { z } from "zod";

type RouteContext = { params: Promise<{ activityId: string }> };

const deleteScopeSchema = z.object({
  scope: z.enum(["instance", "future", "series"]).default("instance"),
});

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
      ...(body.color !== undefined
        ? { color: normalizeActivityColor(body.color) }
        : {}),
    },
  });

  return NextResponse.json({ activity });
}

/** Preview delete impact (activity + check-in counts) for confirmation UI. */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { activityId } = await context.params;
  const campSession = await requireOrganizationSession(session.user.organizationId);
  const scopeParam = request.nextUrl.searchParams.get("scope") ?? "instance";
  const parsed = deleteScopeSchema.safeParse({ scope: scopeParam });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  try {
    const impact = await getActivityDeleteImpact(
      campSession.id,
      activityId,
      parsed.data.scope as ActivityDeleteScope,
    );
    return NextResponse.json({
      scope: impact.scope,
      activityCount: impact.activityCount,
      checkInCount: impact.checkInCount,
      seriesId: impact.seriesId,
      activityName: impact.activityName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { activityId } = await context.params;
  const campSession = await requireOrganizationSession(session.user.organizationId);

  let scope: ActivityDeleteScope = "instance";
  try {
    const body = await request.json();
    const parsed = deleteScopeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }
    scope = parsed.data.scope;
  } catch {
    // empty body → instance
  }

  try {
    const impact = await deleteActivities(campSession.id, activityId, scope);

    logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      resource: AUDIT_RESOURCES.SETTINGS,
      action: "delete",
      targetRecord: activityId,
      metadata: {
        area: "activity_delete",
        scope: impact.scope,
        activityName: impact.activityName,
        activityCount: impact.activityCount,
        checkInCount: impact.checkInCount,
        seriesId: impact.seriesId,
        deletedActivityIds: impact.activityIds,
      },
    });

    return NextResponse.json({
      ok: true,
      deletedIds: impact.activityIds,
      activityCount: impact.activityCount,
      checkInCount: impact.checkInCount,
      scope: impact.scope,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
