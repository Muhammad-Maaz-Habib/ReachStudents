import { z } from "zod";

export const tripLocationCheckInSchema = z.object({
  studentId: z.string().min(1),
  tripLabel: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  accuracyMeters: z.number().optional(),
  note: z.string().optional(),
});

export const emergencyProtocolUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  steps: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().min(1),
        order: z.number().int(),
      }),
    )
    .optional(),
  isActive: z.boolean().optional(),
});
