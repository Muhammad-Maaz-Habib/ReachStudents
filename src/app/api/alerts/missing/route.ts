import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMissingStudentAlerts } from "@/lib/alerts/missing-students";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SCHEDULES,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const alerts = await getMissingStudentAlerts(campSession.id);

  return NextResponse.json({
    alerts: alerts.map((alert) => ({
      ...alert,
      startTime: alert.startTime.toISOString(),
    })),
    totalMissing: alerts.reduce((sum, a) => sum + a.students.length, 0),
  });
}
