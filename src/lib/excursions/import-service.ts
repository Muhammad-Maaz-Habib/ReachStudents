import { prisma } from "@/lib/prisma";
import {
  parseScheduleDate,
  parseStartTimeMinutes,
} from "@/lib/csv/schedule-import";
import type { ExcursionCsvRow } from "@/lib/csv/excursion-import";

export type ImportExcursionResult = {
  excursion: { id: string; name: string };
  action: "created" | "updated";
};

/**
 * Create or update an excursion by name (case-insensitive) within a session.
 */
export async function importExcursionRecord({
  sessionId,
  data,
}: {
  sessionId: string;
  data: ExcursionCsvRow;
}): Promise<ImportExcursionResult> {
  const name = data.name.trim();
  if (!name) throw new Error("name is required");

  const startDate = parseScheduleDate(data.start_date);
  if (!startDate) {
    throw new Error(`Invalid start_date "${data.start_date}" (use YYYY-MM-DD)`);
  }

  const startTimeMinutes = parseStartTimeMinutes(data.start_time);
  if (startTimeMinutes === null) {
    throw new Error(
      `Invalid start_time "${data.start_time}" (use HH:MM or H:MM AM/PM)`,
    );
  }

  const durationMinutes = Number(data.duration_minutes);
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 15 ||
    durationMinutes > 24 * 60
  ) {
    throw new Error(
      `duration_minutes must be an integer between 15 and 1440 (got "${data.duration_minutes}")`,
    );
  }

  let capacity: number | null = null;
  if (data.capacity?.trim()) {
    capacity = Number(data.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10_000) {
      throw new Error(
        `capacity must be an integer 1–10000 (got "${data.capacity}")`,
      );
    }
  }

  const startTime = new Date(startDate);
  startTime.setUTCHours(
    Math.floor(startTimeMinutes / 60),
    startTimeMinutes % 60,
    0,
    0,
  );
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const destination = data.destination?.trim() || null;
  const notes = data.notes?.trim() || null;

  const existing = await prisma.excursion.findFirst({
    where: {
      sessionId,
      name: { equals: name, mode: "insensitive" },
    },
  });

  if (existing) {
    const updated = await prisma.excursion.update({
      where: { id: existing.id },
      data: {
        name,
        destination,
        notes,
        capacity,
        startTime,
        endTime,
      },
      select: { id: true, name: true },
    });
    return { excursion: updated, action: "updated" };
  }

  const created = await prisma.excursion.create({
    data: {
      sessionId,
      name,
      destination,
      notes,
      capacity,
      startTime,
      endTime,
    },
    select: { id: true, name: true },
  });

  return { excursion: created, action: "created" };
}
