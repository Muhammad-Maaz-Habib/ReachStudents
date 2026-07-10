import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/constants";
import { tripLocationCheckInSchema } from "@/lib/validations/emergency";
import {
  purgeExpiredTripLocationCheckIns,
  tripLocationCutoffDate,
} from "@/lib/emergency/trip-location-retention";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  await purgeExpiredTripLocationCheckIns();

  const cutoff = tripLocationCutoffDate();
  const checkIns = await prisma.tripLocationCheckIn.findMany({
    where: {
      sessionId: campSession.id,
      createdAt: { gte: cutoff },
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      recordedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    checkIns: checkIns.map((row) => ({
      id: row.id,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
      tripLabel: row.tripLabel,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracyMeters: row.accuracyMeters,
      note: row.note,
      recordedByName: row.recordedBy.name,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = tripLocationCheckInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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

  const checkIn = await prisma.tripLocationCheckIn.create({
    data: {
      sessionId: campSession.id,
      studentId: parsed.data.studentId,
      recordedById: session.user.id,
      tripLabel: parsed.data.tripLabel,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracyMeters: parsed.data.accuracyMeters,
      note: parsed.data.note,
    },
  });

  void purgeExpiredTripLocationCheckIns();

  return NextResponse.json({
    id: checkIn.id,
    createdAt: checkIn.createdAt.toISOString(),
  });
}
