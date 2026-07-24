export const EXCURSION_CSV_COLUMNS = [
  "name",
  "destination",
  "start_date",
  "start_time",
  "duration_minutes",
  "capacity",
  "notes",
] as const;

export type ExcursionCsvRow = {
  name: string;
  destination?: string;
  start_date: string;
  start_time: string;
  duration_minutes: string;
  capacity?: string;
  notes?: string;
};

export type ExcursionCsvParseResult = {
  rows: ExcursionCsvRow[];
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

export function parseExcursionCsv(content: string): ExcursionCsvParseResult {
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
  const rows: ExcursionCsvRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });

    const rowNumber = lineIndex + 1;

    if (
      !record.name ||
      !record.start_date ||
      !record.start_time ||
      !record.duration_minutes
    ) {
      errors.push(
        `Row ${rowNumber}: name, start_date, start_time, and duration_minutes are required`,
      );
      continue;
    }

    rows.push({
      name: record.name,
      destination: record.destination || undefined,
      start_date: record.start_date,
      start_time: record.start_time,
      duration_minutes: record.duration_minutes,
      capacity: record.capacity || undefined,
      notes: record.notes || undefined,
    });
  }

  return { rows, errors };
}
