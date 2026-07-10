import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { sessionRetentionUpdateSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SETTINGS,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      sessionDataRetentionPolicy: true,
      sessionDataRetentionDaysAfterEnd: true,
    },
  });

  return NextResponse.json({
    sessionDataRetentionPolicy: organization?.sessionDataRetentionPolicy ?? "NONE",
    sessionDataRetentionDaysAfterEnd:
      organization?.sessionDataRetentionDaysAfterEnd ?? 90,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SETTINGS,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = sessionRetentionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const organization = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: parsed.data,
    select: {
      sessionDataRetentionPolicy: true,
      sessionDataRetentionDaysAfterEnd: true,
    },
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "update",
    targetRecord: session.user.organizationId,
    metadata: { area: "session_data_retention", ...parsed.data },
  });

  return NextResponse.json(organization);
}
