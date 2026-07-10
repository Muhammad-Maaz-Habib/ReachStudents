import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

/** Append-only: GET list only. No PATCH/DELETE routes exist for audit logs. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.REPORTS,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...(resource ? { resource } : {}),
    },
    include: {
      user: { select: { name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      resource: log.resource,
      action: log.action,
      targetRecord: log.targetRecord,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
      user: {
        name: log.user.name,
        email: log.user.email,
        role: log.user.role,
      },
    })),
  });
}
