import { z } from "zod";
import { UserRole } from "@/generated/prisma/browser";

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

export const staffFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  role: z.enum([
    UserRole.STAFF,
    UserRole.NURSE,
    UserRole.SESSION_ADMIN,
  ]),
  email: z.string().trim().email("Valid email is required"),
  phone: z.string().optional(),
  teamId: z.string().optional(),
  emergencyContact1Name: z.string().optional(),
  emergencyContact1Phone: z.string().optional(),
  emergencyContact2Name: z.string().optional(),
  emergencyContact2Phone: z.string().optional(),
  foodAllergy: z.string().optional(),
  dietaryRestriction: z.string().optional(),
  dietaryOther: z.string().optional(),
});

export type StaffFormInput = z.infer<typeof staffFormSchema>;
