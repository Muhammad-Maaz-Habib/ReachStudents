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
