import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { getRollCallData } from "@/lib/attendance/roll-call";
import { STAFF_ROLES } from "@/lib/constants";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const { searchParams } = new URL(request.url);

  const data = await getRollCallData(campSession.id, {
    q: searchParams.get("q") ?? undefined,
    teamId: searchParams.get("teamId") ?? undefined,
    activityId: searchParams.get("activityId") ?? undefined,
  });

  return NextResponse.json({
    totalExpected: data.totalExpected,
    presentCount: data.presentCount,
    missingCount: data.missingCount,
    teams: data.teams,
    present: data.present.map((row) => ({
      student: row.student,
      checkedInAt: row.checkedInAt.toISOString(),
      activity: row.activity,
    })),
    missing: data.missing,
  });
}
