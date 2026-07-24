import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { getLinkedStudentForUser } from "@/lib/students/account-service";
import { staffCanAccessStudentStaffThread } from "@/lib/students/student-portal";
import { studentStaffMessageSchema } from "@/lib/validations/messaging";
import { STAFF_ROLES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";

type RouteContext = { params: Promise<{ threadId: string }> };

async function canAccessThread(
  userId: string,
  role: UserRole,
  organizationId: string,
  thread: { studentId: string; organizationId: string },
) {
  if (thread.organizationId !== organizationId) return false;

  if (role === UserRole.STUDENT) {
    const student = await getLinkedStudentForUser(userId, organizationId);
    return student?.id === thread.studentId;
  }

  if (!STAFF_ROLES.includes(role)) return false;
  const canMessage = await hasPermission(
    organizationId,
    role,
    PermissionResource.MESSAGING,
    "view",
  );
  if (!canMessage) return false;

  return staffCanAccessStudentStaffThread(
    userId,
    role,
    organizationId,
    thread.studentId,
  );
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const thread = await prisma.studentStaffThread.findUnique({
    where: { id: threadId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canAccessThread(
    session.user.id,
    session.user.role,
    session.user.organizationId,
    thread,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    thread: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
    },
    messages: thread.messages.map((message) => ({
      id: message.id,
      body: message.body,
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

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const thread = await prisma.studentStaffThread.findUnique({
    where: { id: threadId },
  });
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canAccessThread(
    session.user.id,
    session.user.role,
    session.user.organizationId,
    thread,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = studentStaffMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.studentStaffMessage.create({
      data: {
        threadId,
        senderId: session.user.id,
        body: parsed.data.body.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });
    await tx.studentStaffThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
    return created;
  });

  return NextResponse.json({
    message: {
      id: message.id,
      body: message.body,
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
