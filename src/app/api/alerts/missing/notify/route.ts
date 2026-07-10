import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dispatchMissingStudentAlerts } from "@/lib/alerts/notify-missing-students";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";

export async function POST() {
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
  const result = await dispatchMissingStudentAlerts(
    session.user.organizationId,
    campSession.id,
  );

  return NextResponse.json(result);
}
