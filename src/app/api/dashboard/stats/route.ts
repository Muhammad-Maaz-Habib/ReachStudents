import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/constants";
import { getMissingStudentCount } from "@/lib/alerts/missing-students";
import { getOpenCheckInsForSession } from "@/lib/checkin/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(
    session.user.organizationId,
  );

  const [openCheckIns, missingCount, studentCount, teamCount] =
    await Promise.all([
      getOpenCheckInsForSession(campSession.id),
      getMissingStudentCount(campSession.id),
      prisma.student.count({ where: { sessionId: campSession.id } }),
      prisma.team.count({ where: { sessionId: campSession.id } }),
    ]);

  return NextResponse.json({
    checkedInNow: openCheckIns.length,
    missingCount,
    studentCount,
    teamCount,
    updatedAt: new Date().toISOString(),
  });
}
