/**
 * Expand a recurrence series into concrete activity instance dates.
 * Stores individual Activity rows (not RRULE-at-read-time) for check-in + alerts.
 */

export type RecurrenceInput = {
  rangeStart: Date;
  rangeEnd: Date;
  recurrenceDays: number[]; // 0=Sun … 6=Sat
  startTimeMinutes: number;
  durationMinutes: number;
};

export function eachDayInRange(start: Date, end: Date) {
  const days: Date[] = [];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  const endUtc = new Date(end);
  endUtc.setUTCHours(23, 59, 59, 999);

  while (cursor <= endUtc) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function buildActivityInstances(input: RecurrenceInput) {
  const instances: { startTime: Date; endTime: Date }[] = [];
  const days = eachDayInRange(input.rangeStart, input.rangeEnd);
  const daySet = new Set(input.recurrenceDays);

  for (const day of days) {
    if (!daySet.has(day.getUTCDay())) continue;

    const startTime = new Date(day);
    startTime.setUTCHours(
      Math.floor(input.startTimeMinutes / 60),
      input.startTimeMinutes % 60,
      0,
      0,
    );
    const endTime = new Date(
      startTime.getTime() + input.durationMinutes * 60 * 1000,
    );
    instances.push({ startTime, endTime });
  }

  return instances;
}

export function minutesToTimeLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}
