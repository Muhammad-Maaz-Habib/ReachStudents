import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { canAccessStudentMessaging } from "@/lib/messaging/parent-access";
import {
  deliverParentMessage,
  notifyStaffOfParentMessage,
} from "@/lib/messaging/parent-delivery";
import { parentMessageSchema } from "@/lib/validations/messaging";

type RouteContext = { params: Promise<{ id: string }> };

async function getThreadForUser(
  threadId: string,
  userId: string,
  organizationId: string,
  role: UserRole,
) {
  const thread = await prisma.parentThread.findFirst({
    where: { id: threadId, organizationId },
    include: {
      student: {
        include: {
          session: { include: { organization: { select: { name: true } } } },
        },
      },
    },
  });
  if (!thread) return null;

  const hasAccess = await canAccessStudentMessaging(
    userId,
    role,
    organizationId,
    thread.studentId,
  );
  if (!hasAccess) return null;

  if (role !== UserRole.PARENT) {
    const allowed = await hasPermission(
      organizationId,
      role,
      PermissionResource.MESSAGING,
      "view",
    );
    if (!allowed) return null;
  }

  return thread;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const thread = await getThreadForUser(
    id,
    session.user.id,
    session.user.organizationId,
    session.user.role,
  );
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await prisma.parentMessage.findMany({
    where: { threadId: id },
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    thread: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      topic: thread.topic,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
    },
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      sentVia: message.sentVia,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        role: message.sender.role,
        isSelf: message.sender.id === session.user.id,
      },
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = parentMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const thread = await getThreadForUser(
    id,
    session.user.id,
    session.user.organizationId,
    session.user.role,
  );
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isParent = session.user.role === UserRole.PARENT;
  if (!isParent) {
    const canEdit = await hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.MESSAGING,
      "edit",
    );
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const senderName = session.user.name ?? session.user.email ?? "User";
  let sentVia = ["in_app"];

  if (isParent) {
    await notifyStaffOfParentMessage({
      organizationId: session.user.organizationId,
      studentId: thread.studentId,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
      senderName,
      body: parsed.data.body,
      threadId: thread.id,
    });
  } else {
    sentVia = await deliverParentMessage({
      organizationId: session.user.organizationId,
      organizationName: thread.student.session.organization.name,
      threadId: thread.id,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
      senderName,
      body: parsed.data.body,
      topic: thread.topic,
      incidentId: thread.incidentId,
      medicalProfileId: thread.medicalProfileId,
      guardianEmail: thread.student.guardianEmail,
      guardianPhone: thread.student.guardianPhone,
    });
  }

  const message = await prisma.parentMessage.create({
    data: {
      threadId: id,
      senderId: session.user.id,
      body: parsed.data.body,
      sentVia,
    },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  await prisma.parentThread.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    message: {
      id: message.id,
      body: message.body,
      sentVia: message.sentVia,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        role: message.sender.role,
        isSelf: true,
      },
    },
  });
}
