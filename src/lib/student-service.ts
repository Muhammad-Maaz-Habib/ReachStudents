import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { StudentFormInput } from "@/lib/validations/student";
import type { RosterCsvRow } from "@/lib/csv/student-import";
import { parseDateOfBirth, sameDateOfBirth } from "@/lib/csv/student-import";
import { normalizePhone } from "@/lib/phone";

type CreateStudentData = StudentFormInput | RosterCsvRow;

export type ImportStudentResult = {
  student: Awaited<ReturnType<typeof prisma.student.create>>;
  action: "created" | "updated";
  warning?: string;
};

function normalizeInput(data: CreateStudentData) {
  const isCsv = "first_name" in data;

  return {
    externalId: isCsv ? data.external_id : undefined,
    firstName: isCsv ? data.first_name : data.firstName,
    lastName: isCsv ? data.last_name : data.lastName,
    dateOfBirth: isCsv ? data.date_of_birth : data.dateOfBirth,
    grade: isCsv ? data.grade : data.grade,
    teamId: isCsv ? undefined : data.teamId,
    teamName: isCsv ? data.team : undefined,
    allergies: isCsv ? data.allergies : data.allergies,
    medications: isCsv ? data.medications : data.medications,
    conditions: isCsv ? data.medical_conditions : data.conditions,
    guardianName: isCsv ? data.guardian_name : data.guardianName,
    guardianEmail: isCsv ? data.guardian_email : data.guardianEmail,
    guardianPhone: isCsv ? data.guardian_phone : data.guardianPhone,
    emergencyContactName: isCsv
      ? data.emergency_contact_name
      : data.emergencyContactName,
    emergencyContactPhone: isCsv
      ? data.emergency_contact_phone
      : data.emergencyContactPhone,
    emergencyContactRelationship: isCsv
      ? data.emergency_contact_relationship
      : data.emergencyContactRelationship,
    emergencyContactEmail: isCsv
      ? data.emergency_contact_email
      : data.emergencyContactEmail,
  };
}

function validatePhones(input: ReturnType<typeof normalizeInput>) {
  const guardian = normalizePhone(input.guardianPhone);
  if (!guardian.ok) {
    throw new Error(`Invalid guardian_phone: ${guardian.reason}`);
  }

  const emergency = normalizePhone(input.emergencyContactPhone);
  if (!emergency.ok) {
    throw new Error(`Invalid emergency_contact_phone: ${emergency.reason}`);
  }

  return {
    guardianPhone: guardian.normalized || null,
    emergencyContactPhone: emergency.normalized || null,
  };
}

function buildStudentFields(
  input: ReturnType<typeof normalizeInput>,
  phones: { guardianPhone: string | null; emergencyContactPhone: string | null },
  teamId: string | null,
  dob: Date | null,
) {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    grade: input.grade?.trim() || null,
    dateOfBirth: dob,
    externalId: input.externalId?.trim() || null,
    guardianName: input.guardianName?.trim() || null,
    guardianEmail: input.guardianEmail?.trim() || null,
    guardianPhone: phones.guardianPhone,
    teamId,
  };
}

async function upsertMedicalProfile(
  tx: Prisma.TransactionClient,
  studentId: string,
  input: ReturnType<typeof normalizeInput>,
) {
  const hasMedical =
    !!input.allergies?.trim() ||
    !!input.medications?.trim() ||
    !!input.conditions?.trim();

  if (!hasMedical) return;

  await tx.medicalProfile.upsert({
    where: { studentId },
    update: {
      allergies: input.allergies?.trim() || null,
      medications: input.medications?.trim() || null,
      conditions: input.conditions?.trim() || null,
    },
    create: {
      studentId,
      allergies: input.allergies?.trim() || null,
      medications: input.medications?.trim() || null,
      conditions: input.conditions?.trim() || null,
    },
  });
}

async function upsertEmergencyContact(
  tx: Prisma.TransactionClient,
  studentId: string,
  input: ReturnType<typeof normalizeInput>,
  phone: string | null,
) {
  if (!input.emergencyContactName?.trim() || !phone) return;

  const existing = await tx.emergencyContact.findFirst({
    where: { studentId },
    orderBy: { isPrimary: "desc" },
  });

  const data = {
    name: input.emergencyContactName.trim(),
    phone,
    relationship: input.emergencyContactRelationship?.trim() || null,
    email: input.emergencyContactEmail?.trim() || null,
  };

  if (existing) {
    await tx.emergencyContact.update({ where: { id: existing.id }, data });
  } else {
    await tx.emergencyContact.create({ data: { studentId, ...data } });
  }
}

export async function importStudentRecord({
  sessionId,
  teams,
  data,
}: {
  sessionId: string;
  teams: { id: string; name: string }[];
  data: RosterCsvRow;
}): Promise<ImportStudentResult> {
  const input = normalizeInput(data);
  const phones = validatePhones(input);
  let teamId: string | null = input.teamId ?? null;

  if (input.teamName) {
    const team = teams.find(
      (entry) => entry.name.toLowerCase() === input.teamName!.toLowerCase(),
    );
    if (!team) {
      throw new Error(`Unknown team "${input.teamName}"`);
    }
    teamId = team.id;
  }

  const dob = parseDateOfBirth(input.dateOfBirth ?? undefined);
  if (input.dateOfBirth && !dob) {
    throw new Error(`Invalid date_of_birth "${input.dateOfBirth}" (use YYYY-MM-DD)`);
  }

  let warning: string | undefined;

  if (input.externalId?.trim()) {
    const existingByExternal = await prisma.student.findFirst({
      where: { sessionId, externalId: input.externalId.trim() },
    });

    if (existingByExternal) {
      const student = await prisma.$transaction(async (tx) => {
        const updated = await tx.student.update({
          where: { id: existingByExternal.id },
          data: buildStudentFields(input, phones, teamId, dob),
        });
        await upsertMedicalProfile(tx, updated.id, input);
        await upsertEmergencyContact(
          tx,
          updated.id,
          input,
          phones.emergencyContactPhone,
        );
        return updated;
      });

      return { student, action: "updated" };
    }
  }

  const nameMatches = await prisma.student.findMany({
    where: {
      sessionId,
      firstName: { equals: input.firstName, mode: "insensitive" },
      lastName: { equals: input.lastName, mode: "insensitive" },
    },
  });

  if (dob) {
    const exactDuplicate = nameMatches.find((student) =>
      sameDateOfBirth(student.dateOfBirth, dob),
    );
    if (exactDuplicate) {
      throw new Error(
        `Duplicate student "${input.firstName} ${input.lastName}" with the same date_of_birth`,
      );
    }
  } else if (nameMatches.length > 0) {
    warning = `Possible duplicate: "${input.firstName} ${input.lastName}" matches ${nameMatches.length} existing student(s) but date_of_birth is missing — please review manually`;
  }

  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.student.create({
      data: {
        sessionId,
        ...buildStudentFields(input, phones, teamId, dob),
      },
    });
    await upsertMedicalProfile(tx, created.id, input);
    await upsertEmergencyContact(
      tx,
      created.id,
      input,
      phones.emergencyContactPhone,
    );
    return created;
  });

  return { student, action: "created", warning };
}

export async function createStudentRecord({
  sessionId,
  teams,
  data,
}: {
  sessionId: string;
  teams: { id: string; name: string }[];
  data: StudentFormInput;
}) {
  const input = normalizeInput(data);
  const guardian = normalizePhone(input.guardianPhone);
  if (!guardian.ok) {
    throw new Error(`Invalid guardian phone: ${guardian.reason}`);
  }
  const emergency = normalizePhone(input.emergencyContactPhone);
  if (!emergency.ok) {
    throw new Error(`Invalid emergency contact phone: ${emergency.reason}`);
  }

  let teamId: string | null = input.teamId ?? null;
  if (input.teamName) {
    const team = teams.find(
      (entry) => entry.name.toLowerCase() === input.teamName!.toLowerCase(),
    );
    if (!team) throw new Error(`Unknown team "${input.teamName}"`);
    teamId = team.id;
  }

  const dob = parseDateOfBirth(input.dateOfBirth ?? undefined);
  const hasMedical =
    !!input.allergies?.trim() ||
    !!input.medications?.trim() ||
    !!input.conditions?.trim();
  const hasEmergency =
    !!input.emergencyContactName?.trim() && !!emergency.normalized;

  const studentData: Prisma.StudentCreateInput = {
    session: { connect: { id: sessionId } },
    ...buildStudentFields(
      input,
      {
        guardianPhone: guardian.normalized || null,
        emergencyContactPhone: emergency.normalized || null,
      },
      teamId,
      dob,
    ),
    ...(teamId ? { team: { connect: { id: teamId } } } : {}),
    ...(hasMedical
      ? {
          medicalProfile: {
            create: {
              allergies: input.allergies?.trim() || null,
              medications: input.medications?.trim() || null,
              conditions: input.conditions?.trim() || null,
            },
          },
        }
      : {}),
    ...(hasEmergency
      ? {
          emergencyContacts: {
            create: {
              name: input.emergencyContactName!.trim(),
              phone: emergency.normalized,
              relationship: input.emergencyContactRelationship?.trim() || null,
              email: input.emergencyContactEmail?.trim() || null,
              isPrimary: false,
            },
          },
        }
      : {}),
  };

  return prisma.student.create({
    data: studentData,
    include: { team: true, medicalProfile: true, emergencyContacts: true },
  });
}
