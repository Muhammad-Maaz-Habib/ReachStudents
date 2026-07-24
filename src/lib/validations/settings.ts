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
  /** When set, copy Teams/MG/Clubs/schedule/excursions/shifts/forms (no students). */
  copyStructureFromSessionId: z.string().min(1).optional(),
});

export const campSessionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const campSessionResetSchema = z.object({
  confirmName: z.string().min(1),
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

export const clubCreateSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  advisorIds: z.array(z.string().min(1)).min(1).max(3),
  studentIds: z.array(z.string().min(1)).optional().default([]),
});

export const clubUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  advisorIds: z.array(z.string().min(1)).min(1).max(3).optional(),
  studentIds: z.array(z.string().min(1)).optional(),
});

const optionalTrimmed = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null || value === "") return null;
    return value;
  });

export const excursionCreateSchema = z
  .object({
    sessionId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    destination: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((value) => {
        if (value == null || value === "") return null;
        return value;
      }),
    notes: optionalTrimmed,
    capacity: z
      .union([z.number().int().positive().max(10_000), z.null()])
      .optional()
      .transform((value) => value ?? null),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Invalid start time",
      });
    }
    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Invalid end time",
      });
    }
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end <= start
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End must be after start",
      });
    }
  });

export const excursionUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    destination: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (value == null || value === "") return null;
        return value;
      }),
    notes: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .nullable()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (value == null || value === "") return null;
        return value;
      }),
    capacity: z
      .union([z.number().int().positive().max(10_000), z.null()])
      .optional(),
    startTime: z.string().min(1).optional(),
    endTime: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startTime) {
      const start = new Date(data.startTime);
      if (Number.isNaN(start.getTime())) {
        ctx.addIssue({
          code: "custom",
          path: ["startTime"],
          message: "Invalid start time",
        });
      }
    }
    if (data.endTime) {
      const end = new Date(data.endTime);
      if (Number.isNaN(end.getTime())) {
        ctx.addIssue({
          code: "custom",
          path: ["endTime"],
          message: "Invalid end time",
        });
      }
    }
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end <= start
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["endTime"],
          message: "End must be after start",
        });
      }
    }
  });

/** Super Admin branding: display name + public logo URL (no file upload in v1). */
export const organizationBrandingSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    logoUrl: z.string().trim().max(2048).optional().nullable(),
  })
  .transform((data) => {
    const raw = data.logoUrl?.trim() ?? "";
    return {
      name: data.name,
      logoUrl: raw === "" ? null : raw,
    };
  })
  .superRefine((data, ctx) => {
    if (
      data.logoUrl !== null &&
      !/^https:\/\/.+/i.test(data.logoUrl) &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(data.logoUrl)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["logoUrl"],
        message:
          "Logo URL must be https:// (or http://localhost for local testing)",
      });
    }
  });
