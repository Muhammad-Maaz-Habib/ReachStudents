import { z } from "zod";

export const activityFormSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    location: z.string().optional(),
    capacity: z.coerce.number().int().positive().optional(),
    color: z.string().optional(),
    teamId: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    isOpenEnded: z.boolean().optional().default(false),
    overdueAlertMinutes: z.coerce.number().int().min(0).max(120).default(15),
    teamScheduleId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.isOpenEnded) return;
    if (!value.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "Start time is required",
      });
    }
    if (!value.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time is required",
      });
    }
  });

export const activitySeriesSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  color: z.string().optional(),
  teamId: z.string().optional(),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).min(1),
  startTimeMinutes: z.number().int().min(0).max(24 * 60 - 1),
  durationMinutes: z.number().int().min(15).max(8 * 60),
  rangeStart: z.string(),
  rangeEnd: z.string(),
  overdueAlertMinutes: z.coerce.number().int().min(0).max(120).default(15),
});

export type ActivityFormInput = z.infer<typeof activityFormSchema>;
export type ActivitySeriesInput = z.infer<typeof activitySeriesSchema>;

const TIME_FMT: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

const DATE_TIME_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function activityOptionLabel(activity: {
  name: string;
  location?: string | null;
  isOpenEnded?: boolean;
}) {
  const parts = [activity.name];
  if (activity.location) parts.push(activity.location);
  if (activity.isOpenEnded) parts.push("Ongoing");
  return parts.join(" · ");
}

/** Human-readable activity window for check-in / schedule summaries. */
export function formatActivityTimeRange(activity: {
  startTime: string | Date;
  endTime: string | Date;
  isOpenEnded?: boolean;
}) {
  const start = new Date(activity.startTime);
  const end = new Date(activity.endTime);

  if (activity.isOpenEnded) {
    return `Started ${start.toLocaleTimeString([], TIME_FMT)} · Ongoing`;
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    if (end > start) {
      return `${start.toLocaleTimeString([], TIME_FMT)} – ${end.toLocaleTimeString([], TIME_FMT)}`;
    }
    return `${start.toLocaleTimeString([], TIME_FMT)} – ${end.toLocaleTimeString([], TIME_FMT)} (overnight)`;
  }

  return `${start.toLocaleString([], DATE_TIME_FMT)} – ${end.toLocaleString([], DATE_TIME_FMT)}`;
}

/** Soft end bound for open-ended roll-call activities (end of session day UTC). */
export function openEndedActivityEnd(sessionEndDate: Date, startTime = new Date()) {
  const sessionEnd = new Date(sessionEndDate);
  sessionEnd.setUTCHours(23, 59, 59, 999);

  const endOfStartDay = new Date(startTime);
  endOfStartDay.setUTCHours(23, 59, 59, 999);

  const minEnd = new Date(startTime.getTime() + 60 * 60 * 1000);

  return new Date(
    Math.max(sessionEnd.getTime(), endOfStartDay.getTime(), minEnd.getTime()),
  );
}

/**
 * Calendar display bounds for FullCalendar.
 * Open-ended activities are capped to the end of their start day so they don't
 * stretch across the whole session on the grid.
 */
export function activityCalendarDisplay(activity: {
  name: string;
  startTime: Date;
  endTime: Date;
  isOpenEnded: boolean;
}) {
  if (!activity.isOpenEnded) {
    return {
      title: activity.name,
      start: activity.startTime,
      end: activity.endTime,
    };
  }

  const start = activity.startTime;
  const endOfStartDay = new Date(start);
  endOfStartDay.setHours(23, 59, 59, 999);
  const minEnd = new Date(start.getTime() + 60 * 60 * 1000);
  let end = endOfStartDay < activity.endTime ? endOfStartDay : activity.endTime;
  if (end <= start) end = minEnd;
  if (end < minEnd) end = minEnd;

  return {
    title: `${activity.name} · Ongoing`,
    start,
    end,
  };
}
