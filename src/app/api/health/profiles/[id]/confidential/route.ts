import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  canEditConfidentialNotes,
  canViewConfidentialNotes,
} from "@/lib/health/confidential-access";
import { prisma } from "@/lib/prisma";
import { confidentialNotesSchema } from "@/lib/validations/health";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canViewConfidentialNotes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const profile = await prisma.medicalProfile.findFirst({
    where: {
      id,
      student: { session: { organizationId: session.user.organizationId } },
    },
    select: { confidentialNotes: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.CONFIDENTIAL_NOTES,
    action: "view",
    targetRecord: id,
  });

  return NextResponse.json({ confidentialNotes: profile.confidentialNotes });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canEditConfidentialNotes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = confidentialNotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.medicalProfile.findFirst({
    where: {
      id,
      student: { session: { organizationId: session.user.organizationId } },
    },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = await prisma.medicalProfile.update({
    where: { id },
    data: { confidentialNotes: parsed.data.confidentialNotes },
    select: { confidentialNotes: true },
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.CONFIDENTIAL_NOTES,
    action: "update",
    targetRecord: id,
  });

  return NextResponse.json({ confidentialNotes: profile.confidentialNotes });
}
