import { NextResponse } from "next/server";
import { ParentThreadTopic, UserRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import {
  canAccessStudentMessaging,
  getAccessibleStudentIdsForStaff,
} from "@/lib/messaging/parent-access";
import {
  deliverParentMessage,
  notifyStaffOfParentMessage,
} from "@/lib/messaging/parent-delivery";
import { parentThreadSchema } from "@/lib/validations/messaging";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isParent = session.user.role === UserRole.PARENT;
  const allowed =
    isParent ||
    (await hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.MESSAGING,
      "view",
    ));
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const accessibleIds = await getAccessibleStudentIdsForStaff(
    session.user.id,
    session.user.role,
    session.user.organizationId,
    campSession.id,
  );

  const studentFilter =
    accessibleIds === "all"
      ? { sessionId: campSession.id }
      : { id: { in: accessibleIds } };

  const threads = await prisma.parentThread.findMany({
    where: {
      organizationId: session.user.organizationId,
      student: studentFilter,
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { name: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    threads: threads.map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      topic: thread.topic,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
      updatedAt: thread.updatedAt.toISOString(),
      lastMessage: thread.messages[0]
        ? {
            body: thread.messages[0].body,
            senderName: thread.messages[0].sender.name,
            createdAt: thread.messages[0].createdAt.toISOString(),
          }
        : null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = parentThreadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const isParent = session.user.role === UserRole.PARENT;
  const canCreate =
    isParent ||
    (await hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.MESSAGING,
      "edit",
    ));
  if (!canCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hasAccess = await canAccessStudentMessaging(
    session.user.id,
    session.user.role,
    session.user.organizationId,
    parsed.data.studentId,
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const topic = isParent
    ? ParentThreadTopic.GENERAL
    : ((parsed.data.topic as ParentThreadTopic | undefined) ??
      ParentThreadTopic.GENERAL);

  const student = await prisma.student.findFirst({
    where: {
      id: parsed.data.studentId,
      session: { organizationId: session.user.organizationId },
    },
    include: {
      session: { include: { organization: { select: { name: true } } } },
      medicalProfile: { select: { id: true } },
    },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const thread = await prisma.parentThread.create({
    data: {
      organizationId: session.user.organizationId,
      studentId: student.id,
      subject: parsed.data.subject,
      topic,
      incidentId: parsed.data.incidentId,
      medicalProfileId:
        parsed.data.medicalProfileId ?? student.medicalProfile?.id,
      messages: {
        create: {
          senderId: session.user.id,
          body: parsed.data.body,
          sentVia: ["in_app"],
        },
      },
    },
    include: { messages: true },
  });

  const senderName = session.user.name ?? session.user.email ?? "Staff";

  if (isParent) {
    await notifyStaffOfParentMessage({
      organizationId: session.user.organizationId,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      senderName,
      body: parsed.data.body,
      threadId: thread.id,
    });
  } else {
    const sentVia = await deliverParentMessage({
      organizationId: session.user.organizationId,
      organizationName: student.session.organization.name,
      threadId: thread.id,
      studentName: `${student.firstName} ${student.lastName}`,
      senderName,
      body: parsed.data.body,
      topic: thread.topic,
      incidentId: thread.incidentId,
      medicalProfileId: thread.medicalProfileId,
      guardianEmail: student.guardianEmail,
      guardianPhone: student.guardianPhone,
    });

    await prisma.parentMessage.update({
      where: { id: thread.messages[0].id },
      data: { sentVia },
    });
  }

  return NextResponse.json({ threadId: thread.id });
}
