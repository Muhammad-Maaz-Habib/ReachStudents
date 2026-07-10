import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";
import {
  exportAttendanceCsv,
  exportCommunicationsCsv,
  exportFormsCsv,
  exportIncidentsCsv,
  exportMedicationsCsv,
} from "@/lib/reports/exports";

const EXPORT_TYPES = [
  "attendance",
  "incidents",
  "medications",
  "forms",
  "communications",
] as const;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.REPORTS,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "attendance";

  if (!EXPORT_TYPES.includes(type as (typeof EXPORT_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.REPORTS,
    action: "export",
    targetRecord: campSession.id,
    metadata: { exportType: type },
  });

  switch (type) {
    case "incidents":
      return exportIncidentsCsv(campSession.id, campSession.name);
    case "medications":
      return exportMedicationsCsv(campSession.id, campSession.name);
    case "forms":
      return exportFormsCsv(campSession.id, campSession.name);
    case "communications":
      return exportCommunicationsCsv(
        session.user.organizationId,
        campSession.id,
        campSession.name,
      );
    default:
      return exportAttendanceCsv(campSession.id, campSession.name);
  }
}
