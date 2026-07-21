import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { requireOrganizationSession } from "@/lib/org";
import { requireStudentAccess, studentInclude } from "@/lib/students";
import { prisma } from "@/lib/prisma";
import { studentFormSchema } from "@/lib/validations/student";
import { parseDateOfBirth } from "@/lib/csv/student-import";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = {
  params: Promise<{ studentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireStudentAccess("view");
  if ("error" in access) return access.error;

  const { user } = access;
  const { studentId } = await context.params;
  const campSession = await requireOrganizationSession(user.organizationId!);

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      sessionId: campSession.id,
    },
    include: {
      ...studentInclude,
      checkIns: {
        take: 10,
        orderBy: { checkedInAt: "desc" },
        include: {
          activity: { select: { name: true, location: true } },
          staff: { select: { name: true } },
        },
      },
      formSubmissions: {
        include: {
          form: { select: { title: true, type: true } },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({ student });
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireStudentAccess("edit");
  if ("error" in access) return access.error;

  const { user } = access;
  const { studentId } = await context.params;
  const body = await request.json();
  const parsed = studentFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const campSession = await requireOrganizationSession(user.organizationId!);
  const existing = await prisma.student.findFirst({
    where: { id: studentId, sessionId: campSession.id },
    include: { medicalProfile: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const data = parsed.data;
  const dob = parseDateOfBirth(data.dateOfBirth);

  const student = await prisma.$transaction(async (tx) => {
    const updated = await tx.student.update({
      where: { id: studentId },
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        grade: data.grade?.trim() || null,
        dateOfBirth: dob,
        teamId: data.teamId || null,
        guardianName: data.guardianName?.trim() || null,
        guardianEmail: data.guardianEmail?.trim() || null,
        guardianPhone: data.guardianPhone?.trim() || null,
      },
    });

    const hasMedical =
      !!data.allergies?.trim() ||
      !!data.medications?.trim() ||
      !!data.conditions?.trim();

    if (hasMedical || existing.medicalProfile) {
      await tx.medicalProfile.upsert({
        where: { studentId },
        update: {
          allergies: data.allergies?.trim() || null,
          medications: data.medications?.trim() || null,
          conditions: data.conditions?.trim() || null,
        },
        create: {
          studentId,
          allergies: data.allergies?.trim() || null,
          medications: data.medications?.trim() || null,
          conditions: data.conditions?.trim() || null,
        },
      });
    }

    if (data.emergencyContactName?.trim() && data.emergencyContactPhone?.trim()) {
      const current = await tx.emergencyContact.findFirst({
        where: { studentId },
        orderBy: { isPrimary: "desc" },
      });

      if (current) {
        await tx.emergencyContact.update({
          where: { id: current.id },
          data: {
            name: data.emergencyContactName.trim(),
            phone: data.emergencyContactPhone.trim(),
            relationship: data.emergencyContactRelationship?.trim() || null,
            email: data.emergencyContactEmail?.trim() || null,
          },
        });
      } else {
        await tx.emergencyContact.create({
          data: {
            studentId,
            name: data.emergencyContactName.trim(),
            phone: data.emergencyContactPhone.trim(),
            relationship: data.emergencyContactRelationship?.trim() || null,
            email: data.emergencyContactEmail?.trim() || null,
          },
        });
      }
    }

    return tx.student.findUniqueOrThrow({
      where: { id: updated.id },
      include: studentInclude,
    });
  });

  return NextResponse.json({ student });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await context.params;
  const campSession = await requireOrganizationSession(session.user.organizationId);

  const existing = await prisma.student.findFirst({
    where: { id: studentId, sessionId: campSession.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      _count: {
        select: {
          checkIns: true,
          formSubmissions: true,
          incidentReports: true,
          wellnessChecks: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Hard delete: related check-ins, forms, medical profile, threads, etc. cascade.
  // Incident reports stay; this student is only unlinked from them.
  await prisma.student.delete({ where: { id: existing.id } });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "delete",
    targetRecord: existing.id,
    metadata: {
      area: "student",
      name: `${existing.firstName} ${existing.lastName}`,
      counts: existing._count,
    },
  });

  return NextResponse.json({ ok: true });
}
