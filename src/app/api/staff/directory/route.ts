import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
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

  const staff = await prisma.user.findMany({
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
      teamAssignments: {
        include: { team: { select: { name: true, color: true } } },
      },
      certifications: {
        orderBy: { type: "asc" },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json({
    staff: staff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      teams: member.teamAssignments.map((assignment) => assignment.team.name),
      certifications: member.certifications.map((cert) => ({
        id: cert.id,
        type: cert.type,
        label: cert.label,
        expiresAt: cert.expiresAt?.toISOString() ?? null,
      })),
    })),
  });
}
