import { NextResponse } from "next/server";
import { ParentThreadTopic } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { canFileIncidentForStudent } from "@/lib/health/student-access";
import { deliverParentMessage } from "@/lib/messaging/parent-delivery";
import { incidentSchema } from "@/lib/validations/health";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.INCIDENTS,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const incidents = await prisma.incidentReport.findMany({
    where: { sessionId: campSession.id },
    include: {
      reportedBy: { select: { name: true } },
      students: { select: { id: true, firstName: true, lastName: true } },
      linkedThreads: { select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    incidents: incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      status: incident.status,
      location: incident.location,
      createdAt: incident.createdAt.toISOString(),
      reportedByName: incident.reportedBy.name,
      students: incident.students.map(
        (student) => `${student.firstName} ${student.lastName}`,
      ),
      hasParentThread:
        incident.linkedThreads.length > 0 || !!incident.sourceParentThreadId,
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
    PermissionResource.INCIDENTS,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = incidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  for (const studentId of parsed.data.studentIds) {
    const canAccess = await canFileIncidentForStudent(
      session.user.id,
      session.user.role,
      session.user.organizationId,
      studentId,
    );
    if (!canAccess) {
      return NextResponse.json(
        { error: "You can only file incidents for students on your team" },
        { status: 403 },
      );
    }
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const incident = await prisma.incidentReport.create({
    data: {
      sessionId: campSession.id,
      reportedById: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      actionTaken: parsed.data.actionTaken,
      location: parsed.data.location,
      severity: parsed.data.severity,
      sourceParentThreadId: parsed.data.sourceParentThreadId,
      sourceParentMessageId: parsed.data.sourceParentMessageId,
      students: { connect: parsed.data.studentIds.map((id) => ({ id })) },
    },
    include: {
      students: {
        include: {
          session: { include: { organization: { select: { name: true } } } },
        },
      },
    },
  });

  if (parsed.data.notifyParent && parsed.data.parentMessageBody) {
    const primaryStudent = incident.students[0];
    if (primaryStudent) {
      const thread = await prisma.parentThread.create({
        data: {
          organizationId: session.user.organizationId,
          studentId: primaryStudent.id,
          subject: `Incident: ${incident.title}`,
          topic: ParentThreadTopic.INCIDENT,
          incidentId: incident.id,
          messages: {
            create: {
              senderId: session.user.id,
              body: parsed.data.parentMessageBody,
              sentVia: ["in_app"],
            },
          },
        },
        include: { messages: true },
      });

      await prisma.incidentReport.update({
        where: { id: incident.id },
        data: {
          sourceParentThreadId: thread.id,
          sourceParentMessageId: thread.messages[0].id,
        },
      });

      const sentVia = await deliverParentMessage({
        organizationId: session.user.organizationId,
        organizationName: primaryStudent.session.organization.name,
        threadId: thread.id,
        studentName: `${primaryStudent.firstName} ${primaryStudent.lastName}`,
        senderName: session.user.name ?? session.user.email ?? "Staff",
        body: parsed.data.parentMessageBody,
        topic: ParentThreadTopic.INCIDENT,
        incidentId: incident.id,
        guardianEmail: primaryStudent.guardianEmail,
        guardianPhone: primaryStudent.guardianPhone,
      });

      await prisma.parentMessage.update({
        where: { id: thread.messages[0].id },
        data: { sentVia },
      });
    }
  }

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.INCIDENTS,
    action: "create",
    targetRecord: incident.id,
    metadata: {
      severity: incident.severity,
      studentCount: parsed.data.studentIds.length,
    },
  });

  return NextResponse.json({ id: incident.id });
}
