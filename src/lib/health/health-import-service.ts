import { prisma } from "@/lib/prisma";
import { parseDateOfBirth, sameDateOfBirth } from "@/lib/csv/student-import";
import type { HealthCsvRow } from "@/lib/csv/health-import";
import { healthRowLabel } from "@/lib/csv/health-import";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

export type ImportHealthResult = {
  studentId: string;
  medicalProfileId: string;
  action: "updated" | "created";
};

async function findStudentForHealthRow(
  sessionId: string,
  row: HealthCsvRow,
) {
  const label = healthRowLabel(row);

  if (row.external_id?.trim()) {
    const byExternal = await prisma.student.findFirst({
      where: { sessionId, externalId: row.external_id.trim() },
      include: { medicalProfile: { select: { id: true } } },
    });

    if (!byExternal) {
      throw new Error(
        `No student found with external_id "${row.external_id.trim()}" — refused to create or guess`,
      );
    }

    return byExternal;
  }

  const firstName = row.first_name?.trim();
  const lastName = row.last_name?.trim();

  if (!firstName || !lastName || !row.date_of_birth?.trim()) {
    throw new Error(
      `${label}: without external_id, first_name, last_name, and date_of_birth (YYYY-MM-DD) are all required`,
    );
  }

  const dob = parseDateOfBirth(row.date_of_birth);
  if (!dob) {
    throw new Error(
      `${label}: invalid date_of_birth "${row.date_of_birth}" (use YYYY-MM-DD)`,
    );
  }

  const nameMatches = await prisma.student.findMany({
    where: {
      sessionId,
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    include: { medicalProfile: { select: { id: true } } },
  });

  const exactMatches = nameMatches.filter((student) =>
    sameDateOfBirth(student.dateOfBirth, dob),
  );

  if (exactMatches.length === 0) {
    throw new Error(
      `No student matched "${firstName} ${lastName}" with date_of_birth ${row.date_of_birth} — refused to create or guess`,
    );
  }

  if (exactMatches.length > 1) {
    throw new Error(
      `Ambiguous match for "${firstName} ${lastName}" (${row.date_of_birth}): ${exactMatches.length} students — refused to guess`,
    );
  }

  return exactMatches[0];
}

/**
 * Updates MedicalProfile for an existing student only.
 * Never creates students. Never writes confidentialNotes.
 */
export async function importHealthRecord({
  sessionId,
  organizationId,
  userId,
  data,
}: {
  sessionId: string;
  organizationId: string;
  userId: string;
  data: HealthCsvRow;
}): Promise<ImportHealthResult> {
  if (data.date_of_birth && !parseDateOfBirth(data.date_of_birth)) {
    throw new Error(
      `Invalid date_of_birth "${data.date_of_birth}" (use YYYY-MM-DD)`,
    );
  }

  const student = await findStudentForHealthRow(sessionId, data);

  const medicalData = {
    allergies: data.allergies?.trim() || null,
    medications: data.medications?.trim() || null,
    conditions: data.medical_conditions?.trim() || null,
  };

  const existingId = student.medicalProfile?.id;
  let action: "updated" | "created" = "updated";

  const profile = existingId
    ? await prisma.medicalProfile.update({
        where: { id: existingId },
        data: medicalData,
      })
    : await prisma.medicalProfile.create({
        data: {
          studentId: student.id,
          ...medicalData,
        },
      });

  if (!existingId) action = "created";

  logAudit({
    organizationId,
    userId,
    resource: AUDIT_RESOURCES.HEALTH_RECORDS,
    action: "update",
    targetRecord: profile.id,
    metadata: {
      fields: ["allergies", "medications", "conditions"],
      source: "health_csv_import",
      studentId: student.id,
    },
  });

  return {
    studentId: student.id,
    medicalProfileId: profile.id,
    action,
  };
}
