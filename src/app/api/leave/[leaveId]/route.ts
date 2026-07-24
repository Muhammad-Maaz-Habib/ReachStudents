import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { LeaveRequestStatus } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { leaveRequestReviewSchema } from "@/lib/validations/leave";
import {
  canReviewLeaveRequest,
  notifyLeaveDecision,
} from "@/lib/leave/access";
import { getLinkedStudentForUser } from "@/lib/students/account-service";
import { STAFF_ROLES } from "@/lib/constants";

type RouteContext = { params: Promise<{ leaveId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leaveId } = await context.params;
  const leave = await prisma.leaveRequest.findFirst({
    where: {
      id: leaveId,
      session: { organizationId: session.user.organizationId },
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  if (!leave) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();

  // Student cancel pending
  if (session.user.role === UserRole.STUDENT) {
    const student = await getLinkedStudentForUser(
      session.user.id,
      session.user.organizationId,
    );
    if (!student || student.id !== leave.studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (leave.status !== LeaveRequestStatus.PENDING) {
      return NextResponse.json(
        { error: "Only pending requests can be cancelled" },
        { status: 400 },
      );
    }
    if (body?.action !== "cancel") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: LeaveRequestStatus.CANCELLED },
    });
    return NextResponse.json({
      leave: {
        id: updated.id,
        status: updated.status,
      },
    });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canReview = await canReviewLeaveRequest({
    userId: session.user.id,
    role: session.user.role,
    studentId: leave.studentId,
  });
  if (!canReview) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = leaveRequestReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (leave.status !== LeaveRequestStatus.PENDING) {
    return NextResponse.json(
      { error: "Only pending requests can be reviewed" },
      { status: 400 },
    );
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: leaveId },
    data: {
      status:
        parsed.data.decision === "APPROVED"
          ? LeaveRequestStatus.APPROVED
          : LeaveRequestStatus.DENIED,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reviewNote?.trim() || null,
    },
  });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.user.organizationId },
    select: { name: true },
  });

  void notifyLeaveDecision({
    organizationId: session.user.organizationId,
    organizationName: org.name,
    studentId: leave.student.id,
    studentName: `${leave.student.firstName} ${leave.student.lastName}`,
    status: parsed.data.decision,
    startsAt: leave.startsAt,
    endsAt: leave.endsAt,
    reviewNote: updated.reviewNote,
    reviewerId: session.user.id,
    reviewerName: session.user.name ?? session.user.email ?? "Staff",
  });

  return NextResponse.json({
    leave: {
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      reviewNote: updated.reviewNote,
    },
  });
}
