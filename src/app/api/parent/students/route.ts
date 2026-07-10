import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== UserRole.PARENT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const links = await prisma.studentParent.findMany({
    where: {
      userId: session.user.id,
      student: { sessionId: campSession.id },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          team: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    students: links.map((link) => ({
      id: link.student.id,
      name: `${link.student.firstName} ${link.student.lastName}`,
      teamName: link.student.team?.name ?? null,
    })),
  });
}
