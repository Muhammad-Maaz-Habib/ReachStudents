import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { getCertificationExpiryAlerts } from "@/lib/staff/certification-alerts";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "14");
  const windowDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 14;

  const alerts = await getCertificationExpiryAlerts(
    session.user.organizationId,
    windowDays,
  );

  return NextResponse.json(alerts);
}
