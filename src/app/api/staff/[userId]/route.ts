import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * Soft-deactivate a staff account (isActive=false).
 * Preserves check-ins, incidents, messages, and audit attribution.
 * Removes active-session team assignments so they leave the directory.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;

  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: session.user.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      _count: {
        select: {
          staffShifts: true,
          requestedSwaps: true,
          teamAssignments: true,
          checkIns: true,
        },
      },
    },
  });

  if (!target) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamStaffAssignment.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "delete",
    metadata: {
      area: "staff_deactivate",
      targetUserId: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      counts: target._count,
    },
  });

  return NextResponse.json({
    ok: true,
    mode: "archived",
    message:
      "Staff account deactivated. Historical records are kept; they can no longer sign in.",
  });
}
