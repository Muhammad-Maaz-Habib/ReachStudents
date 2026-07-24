import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { campSessionCreateSchema } from "@/lib/validations/settings";
import { cloneSessionStructure } from "@/lib/sessions/clone-structure";
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

  const sessions = await prisma.campSession.findMany({
    where: { organizationId: session.user.organizationId },
    include: { _count: { select: { teams: true, students: true } } },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
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
  const parsed = campSessionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (!(endDate > startDate)) {
    return NextResponse.json(
      { error: "End date must be after start date" },
      { status: 400 },
    );
  }

  if (parsed.data.copyStructureFromSessionId) {
    const source = await prisma.campSession.findFirst({
      where: {
        id: parsed.data.copyStructureFromSessionId,
        organizationId: session.user.organizationId,
      },
    });
    if (!source) {
      return NextResponse.json(
        { error: "Source session for structure copy not found" },
        { status: 400 },
      );
    }
  }

  const campSession = await prisma.$transaction(async (tx) => {
    if (parsed.data.isActive) {
      await tx.campSession.updateMany({
        where: {
          organizationId: session.user.organizationId!,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    return tx.campSession.create({
      data: {
        organizationId: session.user.organizationId!,
        name: parsed.data.name,
        description: parsed.data.description,
        startDate,
        endDate,
        isActive: parsed.data.isActive,
      },
      include: { _count: { select: { teams: true, students: true } } },
    });
  });

  let cloneSummary = null;
  if (parsed.data.copyStructureFromSessionId) {
    try {
      cloneSummary = await cloneSessionStructure({
        organizationId: session.user.organizationId,
        sourceSessionId: parsed.data.copyStructureFromSessionId,
        targetSessionId: campSession.id,
      });
    } catch (error) {
      await prisma.campSession.delete({ where: { id: campSession.id } });
      const message =
        error instanceof Error ? error.message : "Could not copy structure";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const refreshed = await prisma.campSession.findUniqueOrThrow({
    where: { id: campSession.id },
    include: { _count: { select: { teams: true, students: true } } },
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "create",
    targetRecord: campSession.id,
    metadata: {
      area: "session",
      name: campSession.name,
      copiedFrom: parsed.data.copyStructureFromSessionId ?? null,
      clone: cloneSummary?.cloned ?? null,
    },
  });

  return NextResponse.json(
    { session: refreshed, clone: cloneSummary },
    { status: 201 },
  );
}
