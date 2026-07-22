import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { incidentUpdateSchema } from "@/lib/validations/health";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";
import { requireOrganizationSession } from "@/lib/org";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.INCIDENTS,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = incidentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const incident = await prisma.incidentReport.update({
    where: { id },
    data: parsed.data,
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.INCIDENTS,
    action: "update",
    targetRecord: incident.id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({
    incident: {
      id: incident.id,
      status: incident.status,
      severity: incident.severity,
    },
  });
}

/**
 * Hard-deletes an incident report (admin only).
 * Parent threads are unlinked (incidentId SetNull) and preserved — not deleted.
 * A delete audit row is written before removal for compliance.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const campSession = await requireOrganizationSession(session.user.organizationId);

  const incident = await prisma.incidentReport.findFirst({
    where: { id, sessionId: campSession.id },
    include: {
      _count: {
        select: {
          students: true,
          linkedThreads: true,
        },
      },
    },
  });

  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const linkedThreadCount = incident._count.linkedThreads;
  const hadSourceThread = Boolean(incident.sourceParentThreadId);

  // Audit before delete so the trail survives the hard delete.
  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.INCIDENTS,
    action: "delete",
    targetRecord: incident.id,
    metadata: {
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      reportedById: incident.reportedById,
      studentCount: incident._count.students,
      linkedThreadCount,
      hadSourceThread,
      threadPolicy: "unlink_preserve",
    },
  });

  await prisma.parentThread.updateMany({
    where: { incidentId: incident.id },
    data: { incidentId: null },
  });

  await prisma.incidentReport.delete({ where: { id: incident.id } });

  return NextResponse.json({
    ok: true,
    unlinkedThreads: linkedThreadCount,
    hadSourceThread,
  });
}
