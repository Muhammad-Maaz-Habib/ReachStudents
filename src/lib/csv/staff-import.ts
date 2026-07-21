import { UserRole } from "@/generated/prisma/browser";

export const STAFF_CSV_COLUMNS = [
  "first_name",
  "last_name",
  "role",
  "email",
  "phone",
  "team",
  "emergency_contact_1_name",
  "emergency_contact_1_phone",
  "emergency_contact_2_name",
  "emergency_contact_2_phone",
  "food_allergy",
  "dietary_restriction",
  "dietary_other",
] as const;

/** Roles allowed on staff CSV import (excludes SUPER_ADMIN / PARENT / STUDENT). */
export const IMPORTABLE_STAFF_ROLES: UserRole[] = [
  UserRole.SESSION_ADMIN,
  UserRole.STAFF,
  UserRole.NURSE,
];

export type StaffCsvRow = {
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  phone?: string;
  team?: string;
  emergency_contact_1_name?: string;
  emergency_contact_1_phone?: string;
  emergency_contact_2_name?: string;
  emergency_contact_2_phone?: string;
  food_allergy?: string;
  dietary_restriction?: string;
  dietary_other?: string;
};

export type StaffCsvParseResult = {
  rows: StaffCsvRow[];
  errors: string[];
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

export function normalizeStaffRoleInput(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

export function parseImportableStaffRole(
  value: string,
): { ok: true; role: UserRole } | { ok: false; reason: string } {
  const normalized = normalizeStaffRoleInput(value);
  if (!normalized) {
    return { ok: false, reason: "role is required" };
  }

  const match = IMPORTABLE_STAFF_ROLES.find((role) => role === normalized);
  if (!match) {
    const allowed = IMPORTABLE_STAFF_ROLES.join(", ");
    return {
      ok: false,
      reason: `Unrecognized role "${value}". Allowed: ${allowed}`,
    };
  }

  return { ok: true, role: match };
}

export function parseStaffCsv(content: string): StaffCsvParseResult {
  const errors: string[] = [];
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ["CSV file is empty"] };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows: StaffCsvRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });

    const rowNumber = lineIndex + 1;

    if (!record.first_name || !record.last_name) {
      errors.push(`Row ${rowNumber}: first_name and last_name are required`);
      continue;
    }

    if (!record.email) {
      errors.push(`Row ${rowNumber}: email is required`);
      continue;
    }

    if (!record.role) {
      errors.push(`Row ${rowNumber}: role is required`);
      continue;
    }

    rows.push(record as StaffCsvRow);
  }

  return { rows, errors };
}
