import { z } from "zod";
import { PermissionResource, UserRole } from "@/generated/prisma/browser";

export const permissionMatrixUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        role: z.nativeEnum(UserRole),
        resource: z.nativeEnum(PermissionResource),
        canView: z.boolean(),
        canEdit: z.boolean(),
      }),
    )
    .min(1),
});

export const sessionRetentionUpdateSchema = z.object({
  sessionDataRetentionPolicy: z.enum(["NONE", "ARCHIVE", "DELETE"]),
  sessionDataRetentionDaysAfterEnd: z.number().int().min(1).max(3650),
});

export const campSessionCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

export const campSessionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const teamCreateSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export const teamUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
});

export const mentorGroupCreateSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  mentorId: z.string().min(1),
  studentIds: z.array(z.string().min(1)).optional().default([]),
});

export const mentorGroupUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  mentorId: z.string().min(1).optional(),
  studentIds: z.array(z.string().min(1)).optional(),
});
