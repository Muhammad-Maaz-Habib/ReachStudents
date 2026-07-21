export const SCHEDULE_CSV_COLUMNS = [
  "activity_name",
  "team",
  "start_date",
  "start_time",
  "duration_minutes",
  "recurrence_days",
  "overdue_alert_minutes",
] as const;

export type ScheduleCsvRow = {
  activity_name: string;
  team?: string;
  start_date: string;
  start_time: string;
  duration_minutes: string;
  recurrence_days?: string;
  overdue_alert_minutes?: string;
};

export type ScheduleCsvParseResult = {
  rows: ScheduleCsvRow[];
  errors: string[];
};

const DAY_ALIASES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
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

export function parseScheduleCsv(content: string): ScheduleCsvParseResult {
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
  const rows: ScheduleCsvRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });

    const rowNumber = lineIndex + 1;

    if (
      !record.activity_name ||
      !record.start_date ||
      !record.start_time ||
      !record.duration_minutes
    ) {
      errors.push(
        `Row ${rowNumber}: activity_name, start_date, start_time, and duration_minutes are required`,
      );
      continue;
    }

    rows.push({
      activity_name: record.activity_name,
      team: record.team || undefined,
      start_date: record.start_date,
      start_time: record.start_time,
      duration_minutes: record.duration_minutes,
      recurrence_days: record.recurrence_days || undefined,
      overdue_alert_minutes: record.overdue_alert_minutes || undefined,
    });
  }

  return { rows, errors };
}

/** Parse YYYY-MM-DD into a UTC midnight Date. */
export function parseScheduleDate(value: string): Date | null {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!isoMatch) return null;
  const parsed = new Date(
    `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`,
  );
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Parse start_time as minutes from midnight.
 * Accepts 24h "HH:MM" / "H:MM" or 12h "H:MM AM/PM".
 */
export function parseStartTimeMinutes(value: string): number | null {
  const trimmed = value.trim();
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    const period = twelveHour[3].toUpperCase();
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (period === "AM") {
      if (hours === 12) hours = 0;
    } else if (hours !== 12) {
      hours += 12;
    }
    return hours * 60 + minutes;
  }

  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!twentyFour) return null;
  const hours = Number(twentyFour[1]);
  const minutes = Number(twentyFour[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Parse "Mon,Wed,Fri" (or full day names) into 0=Sun…6=Sat. */
export function parseRecurrenceDays(value?: string): number[] | null {
  if (!value?.trim()) return null;

  const parts = value
    .split(/[,|;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const days: number[] = [];
  for (const part of parts) {
    const mapped = DAY_ALIASES[part];
    if (mapped === undefined) {
      throw new Error(`Unrecognized day "${part}" in recurrence_days`);
    }
    if (!days.includes(mapped)) days.push(mapped);
  }

  return days.sort((a, b) => a - b);
}
