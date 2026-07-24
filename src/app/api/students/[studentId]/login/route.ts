import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { ADMIN_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { studentLoginProvisionSchema } from "@/lib/validations/messaging";
import {
  provisionStudentLogin,
  resetStudentLoginPassword,
  unlinkStudentLogin,
} from "@/lib/students/account-service";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ studentId: string }> };

async function requireAdminEditor(organizationId: string, role: string) {
  if (!ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
    return false;
  }
  return hasPermission(
    organizationId,
    role as never,
    PermissionResource.STUDENTS,
    "edit",
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requireAdminEditor(
    session.user.organizationId,
    session.user.role,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await context.params;
  const body = await request.json();
  const parsed = studentLoginProvisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await provisionStudentLogin({
      organizationId: session.user.organizationId,
      studentId,
      email: parsed.data.email,
      resetPassword: parsed.data.resetPassword,
    });

    logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      resource: AUDIT_RESOURCES.SETTINGS,
      action: "create",
      targetRecord: studentId,
      metadata: {
        area: "student_login",
        action: result.action,
        email: result.email,
      },
    });

    const student = await prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      select: {
        id: true,
        userId: true,
        user: { select: { id: true, email: true, name: true, isActive: true } },
      },
    });

    return NextResponse.json({
      ...result,
      student,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create login";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requireAdminEditor(
    session.user.organizationId,
    session.user.role,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const intent = body?.action === "unlink" ? "unlink" : "reset";

  try {
    if (intent === "unlink") {
      await unlinkStudentLogin({
        organizationId: session.user.organizationId,
        studentId,
      });
      logAudit({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        resource: AUDIT_RESOURCES.SETTINGS,
        action: "update",
        targetRecord: studentId,
        metadata: { area: "student_login", action: "unlink" },
      });
      return NextResponse.json({ ok: true, unlinked: true });
    }

    const result = await resetStudentLoginPassword({
      organizationId: session.user.organizationId,
      studentId,
    });
    logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      resource: AUDIT_RESOURCES.SETTINGS,
      action: "update",
      targetRecord: studentId,
      metadata: { area: "student_login", action: "reset_password" },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update login";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
