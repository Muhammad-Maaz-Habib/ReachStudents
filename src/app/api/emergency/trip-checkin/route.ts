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

  const campSession = await requireOrganizationSession(
    session.user.organizationId,
  );

  await purgeExpiredTripLocationCheckIns();

  const cutoff = tripLocationCutoffDate();
  const [checkIns, excursions] = await Promise.all([
    prisma.tripLocationCheckIn.findMany({
      where: {
        sessionId: campSession.id,
        createdAt: { gte: cutoff },
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        recordedBy: { select: { name: true } },
        excursion: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.excursion.findMany({
      where: { sessionId: campSession.id },
      select: {
        id: true,
        name: true,
        destination: true,
        startTime: true,
        endTime: true,
      },
      orderBy: [{ startTime: "asc" }, { name: "asc" }],
    }),
  ]);

  return NextResponse.json({
    checkIns: checkIns.map((row) => ({
      id: row.id,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
      excursionId: row.excursionId,
      excursionName: row.excursion?.name ?? null,
      tripLabel: row.tripLabel,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracyMeters: row.accuracyMeters,
      note: row.note,
      recordedByName: row.recordedBy.name,
      createdAt: row.createdAt.toISOString(),
    })),
    excursions: excursions.map((row) => ({
      id: row.id,
      name: row.name,
      destination: row.destination,
      startTime: row.startTime.toISOString(),
      endTime: row.endTime.toISOString(),
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

  const campSession = await requireOrganizationSession(
    session.user.organizationId,
  );

  const student = await prisma.student.findFirst({
    where: {
      id: parsed.data.studentId,
      sessionId: campSession.id,
    },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  let excursionId: string | null = null;
  let tripLabel = parsed.data.tripLabel?.trim() || null;

  if (parsed.data.excursionId) {
    const excursion = await prisma.excursion.findFirst({
      where: {
        id: parsed.data.excursionId,
        sessionId: campSession.id,
      },
      select: { id: true, name: true },
    });
    if (!excursion) {
      return NextResponse.json(
        { error: "Excursion not found in this session" },
        { status: 400 },
      );
    }
    excursionId = excursion.id;
    if (!tripLabel) {
      tripLabel = excursion.name;
    }
  }

  const checkIn = await prisma.tripLocationCheckIn.create({
    data: {
      sessionId: campSession.id,
      studentId: parsed.data.studentId,
      recordedById: session.user.id,
      excursionId,
      tripLabel,
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
