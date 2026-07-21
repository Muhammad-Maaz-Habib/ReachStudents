import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { requireOrganizationSession } from "@/lib/org";
import { parseStaffCsv } from "@/lib/csv/staff-import";
import { importStaffRecord } from "@/lib/staff/staff-service";
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
  const { rows, errors: parseErrors } = parseStaffCsv(content);

  if (rows.length === 0 && parseErrors.length > 0) {
    return NextResponse.json(
      {
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: parseErrors,
        warnings: [],
        temporaryCredentials: [],
      },
      { status: 400 },
    );
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const importErrors = [...parseErrors];
  const warnings: string[] = [];
  const temporaryCredentials: {
    email: string;
    name: string;
    temporaryPassword: string;
  }[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const displayName = `${row.first_name} ${row.last_name}`;
    try {
      const result = await importStaffRecord({
        organizationId: session.user.organizationId,
        sessionId: campSession.id,
        teams: campSession.teams,
        data: row,
      });

      if (result.action === "updated") {
        updated += 1;
      } else {
        imported += 1;
      }

      if (result.temporaryPassword) {
        temporaryCredentials.push({
          email: row.email.trim().toLowerCase(),
          name: displayName,
          temporaryPassword: result.temporaryPassword,
        });
        warnings.push(
          `${displayName}: temporary password ${result.temporaryPassword} (change on first login)`,
        );
      }

      if (result.warning) {
        warnings.push(`${displayName}: ${result.warning}`);
      }
    } catch (error) {
      skipped += 1;
      const message =
        error instanceof Error ? error.message : "Failed to import row";
      importErrors.push(`${displayName}: ${message}`);
    }
  }

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "create",
    targetRecord: campSession.id,
    metadata: {
      area: "staff_csv_import",
      imported,
      updated,
      skipped,
    },
  });

  return NextResponse.json({
    imported,
    updated,
    skipped,
    errors: importErrors,
    warnings,
    temporaryCredentials,
  });
}
