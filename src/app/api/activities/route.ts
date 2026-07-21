import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { activityFormSchema, openEndedActivityEnd } from "@/lib/validations/activity";
import { assignTeamToActivity } from "@/lib/schedule/activities";
import {
  nextActivityColor,
  normalizeActivityColor,
} from "@/lib/schedule/activity-colors";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SCHEDULES,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const activities = await prisma.activity.findMany({
    where: {
      sessionId: campSession.id,
      ...(from && to
        ? {
            startTime: { gte: new Date(from) },
            endTime: { lte: new Date(to) },
          }
        : {}),
    },
    include: {
      team: { select: { id: true, name: true, color: true } },
      schedules: true,
      _count: { select: { checkIns: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SCHEDULES,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = activityFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const data = parsed.data;

  const existingColors = await prisma.activity.findMany({
    where: { sessionId: campSession.id },
    select: { color: true },
  });

  const color = normalizeActivityColor(
    data.color ?? nextActivityColor(existingColors.map((row) => row.color)),
  );

  const isOpenEnded = Boolean(data.isOpenEnded);
  const startTime = isOpenEnded
    ? new Date()
    : new Date(data.startTime!);
  const endTime = isOpenEnded
    ? openEndedActivityEnd(campSession.endDate, startTime)
    : new Date(data.endTime!);

  if (!isOpenEnded && !(endTime > startTime)) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 },
    );
  }

  const activity = await prisma.activity.create({
    data: {
      sessionId: campSession.id,
      name: data.name,
      description: data.description,
      location: data.location,
      capacity: data.capacity ? Number(data.capacity) : null,
      color,
      teamId: data.teamId || null,
      startTime,
      endTime,
      isOpenEnded,
      overdueAlertMinutes: data.overdueAlertMinutes,
    },
  });

  if (data.teamId) {
    await assignTeamToActivity(activity.id, data.teamId);
  }

  return NextResponse.json({ activity }, { status: 201 });
}
