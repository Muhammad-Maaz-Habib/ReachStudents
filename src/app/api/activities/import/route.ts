import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { requireOrganizationSession } from "@/lib/org";
import { parseScheduleCsv } from "@/lib/csv/schedule-import";
import { importScheduleRecord } from "@/lib/schedule/activities";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const content = await file.text();
  const { rows, errors: parseErrors } = parseScheduleCsv(content);

  if (rows.length === 0 && parseErrors.length > 0) {
    return NextResponse.json(
      { imported: 0, updated: 0, skipped: 0, errors: parseErrors, warnings: [] },
      { status: 400 },
    );
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const importErrors = [...parseErrors];
  const warnings: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const result = await importScheduleRecord({
        sessionId: campSession.id,
        sessionEndDate: campSession.endDate,
        teams: campSession.teams,
        data: row,
      });

      imported += 1;
      if (result.action === "created_series") {
        warnings.push(
          `${row.activity_name}: created series with ${result.instanceCount} instance(s)`,
        );
      }
    } catch (error) {
      skipped += 1;
      const message =
        error instanceof Error ? error.message : "Failed to import row";
      importErrors.push(`${row.activity_name}: ${message}`);
    }
  }

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "create",
    targetRecord: campSession.id,
    metadata: {
      area: "schedule_csv_import",
      imported,
      skipped,
    },
  });

  return NextResponse.json({
    imported,
    updated: 0,
    skipped,
    errors: importErrors,
    warnings,
  });
}
