export const HEALTH_CSV_COLUMNS = [
  "external_id",
  "first_name",
  "last_name",
  "date_of_birth",
  "allergies",
  "medications",
  "medical_conditions",
] as const;

export type HealthCsvRow = {
  external_id?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  allergies?: string;
  medications?: string;
  medical_conditions?: string;
};

export type HealthCsvParseResult = {
  rows: HealthCsvRow[];
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

export function parseHealthCsv(content: string): HealthCsvParseResult {
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
  const rows: HealthCsvRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });

    const rowNumber = lineIndex + 1;
    const externalId = record.external_id?.trim() ?? "";
    const firstName = record.first_name?.trim() ?? "";
    const lastName = record.last_name?.trim() ?? "";
    const dob = record.date_of_birth?.trim() ?? "";

    if (!externalId && !(firstName && lastName && dob)) {
      errors.push(
        `Row ${rowNumber}: provide external_id, or first_name + last_name + date_of_birth together`,
      );
      continue;
    }

    rows.push({
      external_id: externalId || undefined,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      date_of_birth: dob || undefined,
      allergies: record.allergies,
      medications: record.medications,
      medical_conditions: record.medical_conditions,
    });
  }

  return { rows, errors };
}

export function healthRowLabel(row: HealthCsvRow) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  if (name && row.external_id) return `${name} (${row.external_id})`;
  if (name) return name;
  if (row.external_id) return row.external_id;
  return "Unknown row";
}
