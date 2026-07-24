import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { parseExcursionCsv } from "@/lib/csv/excursion-import";
import { importExcursionRecord } from "@/lib/excursions/import-service";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SETTINGS,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const sessionIdRaw = formData.get("sessionId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const content = await file.text();
  const { rows, errors: parseErrors } = parseExcursionCsv(content);

  if (rows.length === 0 && parseErrors.length > 0) {
    return NextResponse.json(
      { imported: 0, updated: 0, skipped: 0, errors: parseErrors, warnings: [] },
      { status: 400 },
    );
  }

  const sessionId =
    typeof sessionIdRaw === "string" && sessionIdRaw.trim()
      ? sessionIdRaw.trim()
      : null;

  const campSession = sessionId
    ? await prisma.campSession.findFirst({
        where: {
          id: sessionId,
          organizationId: session.user.organizationId,
        },
      })
    : await prisma.campSession.findFirst({
        where: {
          organizationId: session.user.organizationId,
          isActive: true,
        },
        orderBy: { startDate: "desc" },
      });

  if (!campSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const importErrors = [...parseErrors];
  const warnings: string[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const result = await importExcursionRecord({
        sessionId: campSession.id,
        data: row,
      });
      if (result.action === "updated") updated += 1;
      else imported += 1;
    } catch (error) {
      skipped += 1;
      const message =
        error instanceof Error ? error.message : "Failed to import row";
      importErrors.push(`${row.name}: ${message}`);
    }
  }

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "create",
    targetRecord: campSession.id,
    metadata: {
      area: "excursion_csv_import",
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
  });
}
