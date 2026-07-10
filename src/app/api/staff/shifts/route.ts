import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/constants";
import { staffShiftSchema } from "@/lib/validations/staff";

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
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter =
    from && to
      ? {
          date: {
            gte: new Date(from),
            lte: new Date(to),
          },
        }
      : {};

  const shifts = await prisma.staffShift.findMany({
    where: { sessionId: campSession.id, ...dateFilter },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({
    shifts: shifts.map((shift) => ({
      id: shift.id,
      userId: shift.userId,
      userName: shift.user.name,
      userRole: shift.user.role,
      date: shift.date.toISOString().slice(0, 10),
      dutyLabel: shift.dutyLabel,
      roleOnDuty: shift.roleOnDuty,
      requiredCertification: shift.requiredCertification,
      startTime: shift.startTime?.toISOString() ?? null,
      endTime: shift.endTime?.toISOString() ?? null,
      isOwn: shift.userId === session.user.id,
    })),
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
  const parsed = staffShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const date = new Date(parsed.data.date);

  const shift = await prisma.staffShift.create({
    data: {
      sessionId: campSession.id,
      userId: parsed.data.userId,
      date,
      dutyLabel: parsed.data.dutyLabel,
      roleOnDuty: parsed.data.roleOnDuty,
      requiredCertification: parsed.data.requiredCertification,
      startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : undefined,
      endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : undefined,
    },
  });

  return NextResponse.json({ id: shift.id });
}
