import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/constants";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ userId: string }> };

const updateTeamsSchema = z.object({
  teamIds: z.array(z.string().min(1)),
});

/**
 * Replace a staff member's team assignments for the active camp session.
 * Session Admin / Super Admin only. Takes effect immediately (no re-login).
 */
export async function PUT(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;
  const body = await request.json();
  const parsed = updateTeamsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const target = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: session.user.organizationId,
      isActive: true,
      role: { in: STAFF_ROLES },
    },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  const uniqueTeamIds = [...new Set(parsed.data.teamIds)];
  if (uniqueTeamIds.length > 0) {
    const validTeams = await prisma.team.findMany({
      where: {
        sessionId: campSession.id,
        id: { in: uniqueTeamIds },
      },
      select: { id: true },
    });
    if (validTeams.length !== uniqueTeamIds.length) {
      return NextResponse.json(
        { error: "One or more teams are invalid for this session" },
        { status: 400 },
      );
    }
  }

  const sessionTeams = await prisma.team.findMany({
    where: { sessionId: campSession.id },
    select: { id: true },
  });
  const sessionTeamIds = sessionTeams.map((team) => team.id);

  await prisma.$transaction(async (tx) => {
    await tx.teamStaffAssignment.deleteMany({
      where: {
        userId,
        teamId: { in: sessionTeamIds },
      },
    });

    if (uniqueTeamIds.length > 0) {
      await tx.teamStaffAssignment.createMany({
        data: uniqueTeamIds.map((teamId) => ({
          userId,
          teamId,
          isLead: false,
        })),
      });
    }
  });

  const assignments = await prisma.teamStaffAssignment.findMany({
    where: {
      userId,
      team: { sessionId: campSession.id },
    },
    include: { team: { select: { id: true, name: true, color: true } } },
    orderBy: { team: { name: "asc" } },
  });

  return NextResponse.json({
    userId,
    teams: assignments.map((assignment) => ({
      id: assignment.team.id,
      name: assignment.team.name,
      color: assignment.team.color,
    })),
  });
}
