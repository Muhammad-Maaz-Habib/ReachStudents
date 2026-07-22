import { NextResponse } from "next/server";
import { requireOrganizationSession } from "@/lib/org";
import { importStudentRecord } from "@/lib/student-service";
import { parseRosterCsv } from "@/lib/csv/student-import";
import { requireStudentAccess } from "@/lib/students";

export async function POST(request: Request) {
  const access = await requireStudentAccess("edit");
  if ("error" in access) return access.error;

  const { user } = access;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const content = await file.text();
  const { rows, errors: parseErrors } = parseRosterCsv(content);

  if (rows.length === 0 && parseErrors.length > 0) {
    return NextResponse.json(
      { imported: 0, updated: 0, skipped: 0, errors: parseErrors, warnings: [] },
      { status: 400 },
    );
  }

  const campSession = await requireOrganizationSession(user.organizationId!);
  const importErrors = [...parseErrors];
  const warnings: string[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const result = await importStudentRecord({
        sessionId: campSession.id,
        teams: campSession.teams,
        mentorGroups: campSession.mentorGroups,
        data: row,
      });

      if (result.action === "updated") {
        updated += 1;
      } else {
        imported += 1;
      }

      if (result.warning) {
        warnings.push(`${row.first_name} ${row.last_name}: ${result.warning}`);
      }
    } catch (error) {
      skipped += 1;
      const message =
        error instanceof Error ? error.message : "Failed to import row";
      importErrors.push(`${row.first_name} ${row.last_name}: ${message}`);
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
