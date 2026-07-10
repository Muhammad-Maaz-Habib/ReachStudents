import { z } from "zod";

export const staffShiftSchema = z.object({
  userId: z.string().min(1),
  date: z.string().min(1),
  dutyLabel: z.string().min(1),
  roleOnDuty: z.string().optional(),
  requiredCertification: z
    .enum(["LIFEGUARD", "FIRST_AID", "CPR", "WATERFRONT", "DRIVER", "OTHER"])
    .optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export const shiftSwapSchema = z.object({
  requesterShiftId: z.string().min(1),
  targetShiftId: z.string().min(1),
});

export const staffCertificationSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["LIFEGUARD", "FIRST_AID", "CPR", "WATERFRONT", "DRIVER", "OTHER"]),
  label: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const staffResourceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  url: z.string().url().optional().or(z.literal("")),
});
