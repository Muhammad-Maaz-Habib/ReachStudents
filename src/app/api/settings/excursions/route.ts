import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { excursionCreateSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

function shapeExcursion<T extends { startTime: Date; endTime: Date }>(
  excursion: T,
) {
  return {
    ...excursion,
    startTime: excursion.startTime.toISOString(),
    endTime: excursion.endTime.toISOString(),
  };
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  const campSession = sessionId
    ? await prisma.campSession.findFirst({
        where: {
          id: sessionId,
          organizationId: session.user.organizationId,
        },
      })
    : await prisma.campSession.findFirst({
        where: {
          organizationId: session.user.organizationId,
          isActive: true,
        },
        orderBy: { startDate: "desc" },
      });

  if (!campSession) {
    return NextResponse.json({ error: "No session found" }, { status: 404 });
  }

  const excursions = await prisma.excursion.findMany({
    where: { sessionId: campSession.id },
    orderBy: [{ startTime: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    session: campSession,
    excursions: excursions.map(shapeExcursion),
  });
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
  const parsed = excursionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campSession = await prisma.campSession.findFirst({
    where: {
      id: parsed.data.sessionId,
      organizationId: session.user.organizationId,
    },
  });
  if (!campSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const duplicate = await prisma.excursion.findFirst({
    where: {
      sessionId: campSession.id,
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
  });
  if (duplicate) {
    return NextResponse.json(
      {
        error: `An excursion named "${duplicate.name}" already exists in this session`,
      },
      { status: 409 },
    );
  }

  const excursion = await prisma.excursion.create({
    data: {
      sessionId: campSession.id,
      name: parsed.data.name.trim(),
      destination: parsed.data.destination,
      notes: parsed.data.notes,
      capacity: parsed.data.capacity,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
    },
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "create",
    targetRecord: excursion.id,
    metadata: { area: "excursion", name: excursion.name },
  });

  return NextResponse.json({ excursion: shapeExcursion(excursion) });
}
