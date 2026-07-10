import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import {
  medicationLogSchema,
  wellnessCheckSchema,
} from "@/lib/validations/health";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.HEALTH_RECORDS,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const [medicationLogs, wellnessChecks, flaggedStudents] = await Promise.all([
    prisma.medicationLog.findMany({
      where: {
        medicalProfile: { student: { sessionId: campSession.id } },
      },
      include: {
        medicalProfile: {
          include: {
            student: { select: { firstName: true, lastName: true } },
          },
        },
        administeredBy: { select: { name: true } },
      },
      orderBy: { administeredAt: "desc" },
      take: 25,
    }),
    prisma.wellnessCheck.findMany({
      where: { student: { sessionId: campSession.id } },
      include: {
        student: { select: { firstName: true, lastName: true } },
        staff: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 25,
    }),
    prisma.student.findMany({
      where: {
        sessionId: campSession.id,
        medicalProfile: {
          OR: [
            { allergies: { not: null } },
            { medications: { not: null } },
            { conditions: { not: null } },
          ],
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        medicalProfile: {
          select: { id: true, allergies: true, medications: true, conditions: true },
        },
      },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    medicationLogs: medicationLogs.map((log) => ({
      id: log.id,
      studentName: `${log.medicalProfile.student.firstName} ${log.medicalProfile.student.lastName}`,
      medicationName: log.medicationName,
      dosage: log.dosage,
      notes: log.notes,
      administeredAt: log.administeredAt.toISOString(),
      administeredByName: log.administeredBy.name,
    })),
    wellnessChecks: wellnessChecks.map((check) => ({
      id: check.id,
      studentName: `${check.student.firstName} ${check.student.lastName}`,
      mood: check.mood,
      energy: check.energy,
      notes: check.notes,
      date: check.date.toISOString(),
      staffName: check.staff.name,
    })),
    medicalProfiles: flaggedStudents.map((student) => ({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      medicalProfileId: student.medicalProfile?.id,
      allergies: student.medicalProfile?.allergies,
      medications: student.medicalProfile?.medications,
      conditions: student.medicalProfile?.conditions,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.type === "medication") {
    const allowed = await hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.HEALTH_RECORDS,
      "edit",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = medicationLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const log = await prisma.medicationLog.create({
      data: {
        medicalProfileId: parsed.data.medicalProfileId,
        administeredById: session.user.id,
        medicationName: parsed.data.medicationName,
        dosage: parsed.data.dosage,
        notes: parsed.data.notes,
      },
      include: {
        administeredBy: { select: { name: true } },
      },
    });

    logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      resource: AUDIT_RESOURCES.HEALTH_RECORDS,
      action: "create",
      targetRecord: log.id,
      metadata: {
        type: "medication_log",
        medicalProfileId: parsed.data.medicalProfileId,
      },
    });

    return NextResponse.json({
      id: log.id,
      administeredAt: log.administeredAt.toISOString(),
      administeredByName: log.administeredBy.name,
    });
  }

  if (body.type === "wellness") {
    const allowed = await hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.HEALTH_RECORDS,
      "view",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = wellnessCheckSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const check = await prisma.wellnessCheck.create({
      data: {
        studentId: parsed.data.studentId,
        staffId: session.user.id,
        mood: parsed.data.mood,
        energy: parsed.data.energy,
        notes: parsed.data.notes,
      },
    });

    logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      resource: AUDIT_RESOURCES.HEALTH_RECORDS,
      action: "create",
      targetRecord: check.id,
      metadata: { type: "wellness_check", studentId: parsed.data.studentId },
    });

    return NextResponse.json({ id: check.id });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
