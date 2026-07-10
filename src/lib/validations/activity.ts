import { z } from "zod";

export const activityFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  color: z.string().optional(),
  teamId: z.string().optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  overdueAlertMinutes: z.coerce.number().int().min(0).max(120).default(15),
  teamScheduleId: z.string().optional(),
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
