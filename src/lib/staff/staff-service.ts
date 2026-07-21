import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import {
  parseImportableStaffRole,
  type StaffCsvRow,
} from "@/lib/csv/staff-import";

type TeamOption = { id: string; name: string };

export type ImportStaffResult = {
  action: "imported" | "updated";
  userId: string;
  temporaryPassword?: string;
  warning?: string;
};

function generateTemporaryPassword() {
  return `CampTemp-${randomBytes(4).toString("hex")}`;
}

function optionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requirePhone(label: string, value?: string) {
  const result = normalizePhone(value);
  if (!result.ok) {
    throw new Error(`${label}: ${result.reason}`);
  }
  return result.normalized || null;
}

export async function importStaffRecord({
  organizationId,
  sessionId,
  teams,
  data,
}: {
  organizationId: string;
  sessionId: string;
  teams: TeamOption[];
  data: StaffCsvRow;
}): Promise<ImportStaffResult> {
  const email = data.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Invalid email "${data.email}"`);
  }

  const roleParsed = parseImportableStaffRole(data.role);
  if (!roleParsed.ok) {
    throw new Error(roleParsed.reason);
  }
  const role: UserRole = roleParsed.role;

  const phone = requirePhone("phone", data.phone);
  const emergencyContact1Phone = requirePhone(
    "emergency_contact_1_phone",
    data.emergency_contact_1_phone,
  );
  const emergencyContact2Phone = requirePhone(
    "emergency_contact_2_phone",
    data.emergency_contact_2_phone,
  );

  let teamId: string | null = null;
  let warning: string | undefined;
  const teamName = data.team?.trim();
  if (teamName) {
    const team = teams.find(
      (entry) => entry.name.toLowerCase() === teamName.toLowerCase(),
    );
    if (!team) {
      throw new Error(`Unknown team "${teamName}"`);
    }
    teamId = team.id;
  } else {
    warning = "No team assigned";
  }

  const name = `${data.first_name.trim()} ${data.last_name.trim()}`.trim();
  const profileFields = {
    name,
    role,
    phone,
    emergencyContact1Name: optionalText(data.emergency_contact_1_name),
    emergencyContact1Phone,
    emergencyContact2Name: optionalText(data.emergency_contact_2_name),
    emergencyContact2Phone,
    foodAllergy: optionalText(data.food_allergy),
    dietaryRestriction: optionalText(data.dietary_restriction),
    dietaryOther: optionalText(data.dietary_other),
    isActive: true,
  };

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.organizationId && existing.organizationId !== organizationId) {
    throw new Error(`Email "${email}" belongs to another organization`);
  }

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...profileFields,
        organizationId,
      },
    });

    await syncSessionTeamAssignment({
      userId: user.id,
      sessionId,
      teamId,
    });

    return {
      action: "updated",
      userId: user.id,
      warning,
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      passwordHash,
      mustChangePassword: true,
      ...profileFields,
    },
  });

  await syncSessionTeamAssignment({
    userId: user.id,
    sessionId,
    teamId,
  });

  return {
    action: "imported",
    userId: user.id,
    temporaryPassword,
    warning,
  };
}

async function syncSessionTeamAssignment({
  userId,
  sessionId,
  teamId,
}: {
  userId: string;
  sessionId: string;
  teamId: string | null;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.teamStaffAssignment.deleteMany({
      where: {
        userId,
        team: { sessionId },
      },
    });

    if (teamId) {
      await tx.teamStaffAssignment.create({
        data: { userId, teamId },
      });
    }
  });
}
