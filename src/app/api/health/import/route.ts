import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { UserRole } from "@/generated/prisma/browser";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { requireOrganizationSession } from "@/lib/org";
import { parseHealthCsv, healthRowLabel } from "@/lib/csv/health-import";
import { importHealthRecord } from "@/lib/health/health-import-service";

async function canImportHealth(
  organizationId: string,
  role: UserRole,
): Promise<boolean> {
  if (ADMIN_ROLES.includes(role)) return true;
  return hasPermission(
    organizationId,
    role,
    PermissionResource.HEALTH_RECORDS,
    "edit",
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await canImportHealth(
    session.user.organizationId,
    session.user.role,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const content = await file.text();
  const { rows, errors: parseErrors } = parseHealthCsv(content);

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
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const label = healthRowLabel(row);
    try {
      const result = await importHealthRecord({
        sessionId: campSession.id,
        organizationId: session.user.organizationId,
        userId: session.user.id,
        data: row,
      });

      if (result.action === "created") {
        imported += 1;
      } else {
        updated += 1;
      }
    } catch (error) {
      skipped += 1;
      const message =
        error instanceof Error ? error.message : "Failed to import row";
      importErrors.push(`${label}: ${message}`);
    }
  }

  return NextResponse.json({
    imported,
    updated,
    skipped,
    errors: importErrors,
    warnings,
  });
}
