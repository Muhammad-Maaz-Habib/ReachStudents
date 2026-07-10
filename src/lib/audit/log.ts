import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction, AuditResource } from "@/lib/audit/constants";

export { AUDIT_RESOURCES } from "@/lib/audit/constants";
export type { AuditAction, AuditResource } from "@/lib/audit/constants";

type LogAuditInput = {
  organizationId: string;
  userId: string;
  resource: AuditResource;
  action: AuditAction;
  targetRecord?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Append-only audit write. Fire-and-forget: does not block the caller.
 * View events should be scoped to sensitive-field access only (see call sites).
 */
export function logAudit(input: LogAuditInput) {
  void prisma.auditLog
    .create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        resource: input.resource,
        action: input.action,
        targetRecord: input.targetRecord,
        metadata: input.metadata ?? undefined,
      },
    })
    .catch((error) => {
      console.error("[audit] failed to write log", error);
    });
}
