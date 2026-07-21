import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/constants";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const [staff, teams] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
        role: { in: STAFF_ROLES },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        emergencyContact1Name: true,
        emergencyContact1Phone: true,
        emergencyContact2Name: true,
        emergencyContact2Phone: true,
        foodAllergy: true,
        dietaryRestriction: true,
        dietaryOther: true,
        teamAssignments: {
          where: { team: { sessionId: campSession.id } },
          include: { team: { select: { id: true, name: true, color: true } } },
          orderBy: { team: { name: "asc" } },
        },
        certifications: {
          orderBy: { type: "asc" },
        },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.team.findMany({
      where: { sessionId: campSession.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    teams,
    staff: staff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      emergencyContact1Name: member.emergencyContact1Name,
      emergencyContact1Phone: member.emergencyContact1Phone,
      emergencyContact2Name: member.emergencyContact2Name,
      emergencyContact2Phone: member.emergencyContact2Phone,
      foodAllergy: member.foodAllergy,
      dietaryRestriction: member.dietaryRestriction,
      dietaryOther: member.dietaryOther,
      teams: member.teamAssignments.map((assignment) => assignment.team.name),
      teamIds: member.teamAssignments.map((assignment) => assignment.team.id),
      certifications: member.certifications.map((cert) => ({
        id: cert.id,
        type: cert.type,
        label: cert.label,
        expiresAt: cert.expiresAt?.toISOString() ?? null,
      })),
    })),
  });
}
