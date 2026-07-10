import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { permissionMatrixUpdateSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

const EDITABLE_ROLES: UserRole[] = [
  UserRole.SESSION_ADMIN,
  UserRole.STAFF,
  UserRole.NURSE,
  UserRole.PARENT,
  UserRole.STUDENT,
];

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

  const permissions = await prisma.permissionMatrix.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ role: "asc" }, { resource: "asc" }],
  });

  return NextResponse.json({ permissions });
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
  const parsed = permissionMatrixUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  for (const update of parsed.data.updates) {
    if (update.role === UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Super Admin permissions cannot be edited" },
        { status: 400 },
      );
    }
    if (!EDITABLE_ROLES.includes(update.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (update.canEdit && !update.canView) {
      return NextResponse.json(
        { error: "Edit requires view permission" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(
    parsed.data.updates.map((update) =>
      prisma.permissionMatrix.upsert({
        where: {
          organizationId_role_resource: {
            organizationId: session.user.organizationId!,
            role: update.role,
            resource: update.resource,
          },
        },
        update: {
          canView: update.canView,
          canEdit: update.canEdit,
        },
        create: {
          organizationId: session.user.organizationId!,
          role: update.role,
          resource: update.resource,
          canView: update.canView,
          canEdit: update.canEdit,
        },
      }),
    ),
  );

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "update",
    targetRecord: session.user.organizationId,
    metadata: { changeCount: parsed.data.updates.length },
  });

  const permissions = await prisma.permissionMatrix.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ role: "asc" }, { resource: "asc" }],
  });

  return NextResponse.json({ permissions });
}
