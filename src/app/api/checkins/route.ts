import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import {
  getOpenCheckInsForSession,
  performOnlineCheckIn,
} from "@/lib/checkin/server";
import {
  canCheckInStudent,
  studentCheckInWhere,
} from "@/lib/staff/team-access";
import { z } from "zod";

const checkInActionSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(["check_in", "check_out"]),
  activityId: z.string().nullable().optional(),
  method: z.enum(["tap", "qr"]).default("tap"),
  clientEventId: z.string().uuid(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.STUDENTS,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const studentWhere = await studentCheckInWhere(
    session.user.id,
    session.user.role,
    campSession.id,
  );
  const [students, openCheckIns] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        grade: true,
        team: { select: { id: true, name: true, color: true } },
        medicalProfile: { select: { allergies: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    getOpenCheckInsForSession(campSession.id),
  ]);

  const openByStudent = Object.fromEntries(
    openCheckIns.map((checkIn) => [checkIn.studentId, checkIn]),
  );

  return NextResponse.json({
    session: { id: campSession.id, name: campSession.name },
    students,
    openCheckIns,
    openByStudent,
    checkedInCount: openCheckIns.length,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = checkInActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const canCheckIn = await canCheckInStudent(
    session.user.id,
    session.user.role,
    session.user.organizationId,
    parsed.data.studentId,
  );
  if (!canCheckIn) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const student = await prisma.student.findFirst({
    where: {
      id: parsed.data.studentId,
      sessionId: campSession.id,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const result = await performOnlineCheckIn({
    sessionId: campSession.id,
    staffId: session.user.id,
    studentId: parsed.data.studentId,
    activityId: parsed.data.activityId ?? null,
    method: parsed.data.method,
    type: parsed.data.type,
    clientEventId: parsed.data.clientEventId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.conflict.message, conflict: result.conflict },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    checkIn: result.checkIn,
  });
}
