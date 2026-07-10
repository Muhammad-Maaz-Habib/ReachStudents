import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { medicalProfileUpdateSchema } from "@/lib/validations/health";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.HEALTH_RECORDS,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = medicalProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await prisma.medicalProfile.update({
    where: { id },
    data: parsed.data,
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.HEALTH_RECORDS,
    action: "update",
    targetRecord: profile.id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ id: profile.id });
}
