export const MENTOR_GROUP_CSV_COLUMNS = ["name", "mentor_email"] as const;

export type MentorGroupCsvRow = {
  name: string;
  mentor_email: string;
};

export type MentorGroupCsvParseResult = {
  rows: MentorGroupCsvRow[];
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

export function parseMentorGroupCsv(content: string): MentorGroupCsvParseResult {
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
  const rows: MentorGroupCsvRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });

    const rowNumber = lineIndex + 1;

    if (!record.name) {
      errors.push(`Row ${rowNumber}: name is required`);
      continue;
    }

    if (!record.mentor_email) {
      errors.push(`Row ${rowNumber}: mentor_email is required`);
      continue;
    }

    rows.push({
      name: record.name,
      mentor_email: record.mentor_email.toLowerCase(),
    });
  }

  return { rows, errors };
}
