export const ROSTER_CSV_COLUMNS = [
  "external_id",
  "first_name",
  "last_name",
  "date_of_birth",
  "grade",
  "team",
  "mentor_group",
  "allergies",
  "medications",
  "medical_conditions",
  "guardian_name",
  "guardian_email",
  "guardian_phone",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relationship",
  "emergency_contact_email",
] as const;

export type RosterCsvRow = {
  external_id?: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  grade?: string;
  team?: string;
  mentor_group?: string;
  allergies?: string;
  medications?: string;
  medical_conditions?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  emergency_contact_email?: string;
};

export type CsvParseResult = {
  rows: RosterCsvRow[];
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

export function parseRosterCsv(content: string): CsvParseResult {
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
  const rows: RosterCsvRow[] = [];

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

    rows.push(record as RosterCsvRow);
  }

  return { rows, errors };
}

export function parseDateOfBirth(value?: string) {
  if (!value) return null;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!isoMatch) return null;
  const parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function sameDateOfBirth(a: Date | null | undefined, b: Date | null | undefined) {
  if (!a || !b) return false;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
