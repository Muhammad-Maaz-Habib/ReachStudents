export const CLUB_CSV_COLUMNS = ["name", "advisor_emails"] as const;

export type ClubCsvRow = {
  name: string;
  advisor_emails: string;
};

export type ClubCsvParseResult = {
  rows: ClubCsvRow[];
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

/** Split advisor emails on ; or , (outside quotes already handled by cell). */
export function parseAdvisorEmails(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function parseClubCsv(content: string): ClubCsvParseResult {
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
  const rows: ClubCsvRow[] = [];

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

    if (!record.advisor_emails) {
      errors.push(`Row ${rowNumber}: advisor_emails is required`);
      continue;
    }

    const emails = parseAdvisorEmails(record.advisor_emails);
    if (emails.length === 0) {
      errors.push(`Row ${rowNumber}: advisor_emails must list at least one email`);
      continue;
    }
    if (emails.length > 3) {
      errors.push(`Row ${rowNumber}: at most 3 advisor emails allowed`);
      continue;
    }

    rows.push({
      name: record.name,
      advisor_emails: emails.join(";"),
    });
  }

  return { rows, errors };
}
