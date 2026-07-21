import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { teamCreateSchema } from "@/lib/validations/settings";
import {
  nextActivityColor,
  normalizeActivityColor,
} from "@/lib/schedule/activity-colors";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

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

  const teams = await prisma.team.findMany({
    where: { sessionId: campSession.id },
    include: {
      students: {
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      },
      staff: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { students: true, staff: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ session: campSession, teams });
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
  const parsed = teamCreateSchema.safeParse(body);
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

  const duplicate = await prisma.team.findFirst({
    where: {
      sessionId: campSession.id,
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `A team named "${duplicate.name}" already exists in this session` },
      { status: 409 },
    );
  }

  const existingColors = await prisma.team.findMany({
    where: { sessionId: campSession.id },
    select: { color: true },
  });
  const color = normalizeActivityColor(
    parsed.data.color ?? nextActivityColor(existingColors.map((row) => row.color)),
  );

  const team = await prisma.team.create({
    data: {
      sessionId: campSession.id,
      name: parsed.data.name,
      color,
    },
    include: {
      students: {
        select: { id: true, firstName: true, lastName: true },
      },
      staff: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { students: true, staff: true } },
    },
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "create",
    targetRecord: team.id,
    metadata: { area: "team", name: team.name, sessionId: campSession.id },
  });

  return NextResponse.json({ team }, { status: 201 });
}
