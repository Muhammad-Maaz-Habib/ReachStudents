import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PermissionResource, UserRole } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { getLinkedStudentForUser } from "@/lib/students/account-service";
import {
  getStudentAllowedStaffContacts,
  staffCanAccessStudentStaffThread,
} from "@/lib/students/student-portal";
import { studentStaffThreadSchema } from "@/lib/validations/messaging";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  const role = session.user.role;

  if (role === UserRole.STUDENT) {
    const student = await getLinkedStudentForUser(session.user.id, orgId);
    if (!student) {
      return NextResponse.json({ threads: [], contacts: [] });
    }

    const [threads, contacts] = await Promise.all([
      prisma.studentStaffThread.findMany({
        where: { studentId: student.id, organizationId: orgId },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sender: { select: { id: true, name: true, role: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      getStudentAllowedStaffContacts(orgId, student.id),
    ]);

    return NextResponse.json({
      studentId: student.id,
      contacts,
      threads: threads.map((thread) => ({
        id: thread.id,
        subject: thread.subject,
        status: thread.status,
        updatedAt: thread.updatedAt.toISOString(),
        lastMessage: thread.messages[0]
          ? {
              body: thread.messages[0].body,
              createdAt: thread.messages[0].createdAt.toISOString(),
              senderName: thread.messages[0].sender.name,
            }
          : null,
      })),
    });
  }

  if (!STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canMessage = await hasPermission(
    orgId,
    role,
    PermissionResource.MESSAGING,
    "view",
  );
  if (!canMessage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const threads = await prisma.studentStaffThread.findMany({
    where: { organizationId: orgId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true, role: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const visible = [];
  for (const thread of threads) {
    const ok =
      ADMIN_ROLES.includes(role) ||
      (await staffCanAccessStudentStaffThread(
        session.user.id,
        role,
        orgId,
        thread.studentId,
      ));
    if (!ok) continue;
    visible.push({
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      studentId: thread.student.id,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
      updatedAt: thread.updatedAt.toISOString(),
      lastMessage: thread.messages[0]
        ? {
            body: thread.messages[0].body,
            createdAt: thread.messages[0].createdAt.toISOString(),
            senderName: thread.messages[0].sender.name,
          }
        : null,
    });
  }

  return NextResponse.json({ threads: visible });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.STUDENT) {
    return NextResponse.json(
      { error: "Only students can start student–staff threads" },
      { status: 403 },
    );
  }

  const student = await getLinkedStudentForUser(
    session.user.id,
    session.user.organizationId,
  );
  if (!student) {
    return NextResponse.json(
      { error: "No student roster link for the active session" },
      { status: 400 },
    );
  }

  const canMessage = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.MESSAGING,
    "view",
  );
  if (!canMessage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = studentStaffThreadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const thread = await prisma.studentStaffThread.create({
    data: {
      organizationId: session.user.organizationId,
      studentId: student.id,
      subject: parsed.data.subject?.trim() || null,
      messages: {
        create: {
          senderId: session.user.id,
          body: parsed.data.body.trim(),
        },
      },
    },
  });

  return NextResponse.json({ threadId: thread.id }, { status: 201 });
}
