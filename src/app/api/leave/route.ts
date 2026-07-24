import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PermissionResource, UserRole } from "@/generated/prisma/browser";
import { LeaveRequestStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { getLinkedStudentForUser } from "@/lib/students/account-service";
import { getStudentScheduleItems } from "@/lib/students/student-portal";
import { leaveRequestCreateSchema } from "@/lib/validations/leave";
import { canReviewLeaveRequest } from "@/lib/leave/access";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/constants";
import { studentCheckInWhere } from "@/lib/staff/team-access";

const leaveInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      team: { select: { name: true } },
      mentorGroup: { select: { name: true, mentorId: true } },
    },
  },
  requestedBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true } },
  activities: {
    include: {
      activity: { select: { id: true, name: true, startTime: true } },
    },
  },
} as const;

function shapeLeave<T extends {
  startsAt: Date;
  endsAt: Date;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  activities: { activity: { id: string; name: string; startTime: Date } }[];
}>(row: T) {
  return {
    ...row,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    activities: row.activities.map((link) => ({
      id: link.activity.id,
      name: link.activity.name,
      startTime: link.activity.startTime.toISOString(),
    })),
  };
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campSession = await requireOrganizationSession(
    session.user.organizationId,
  );
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  if (session.user.role === UserRole.STUDENT) {
    const student = await getLinkedStudentForUser(
      session.user.id,
      session.user.organizationId,
    );
    if (!student) {
      return NextResponse.json({ leaves: [], activities: [] });
    }

    const [leaves, activities] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { studentId: student.id },
        include: leaveInclude,
        orderBy: { createdAt: "desc" },
      }),
      getStudentScheduleItems(student.id),
    ]);

    return NextResponse.json({
      leaves: leaves.map(shapeLeave),
      activities: activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        startTime: activity.startTime.toISOString(),
        endTime: activity.endTime.toISOString(),
      })),
    });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canView = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.STUDENTS,
    "view",
  );
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const studentWhere = await studentCheckInWhere(
    session.user.id,
    session.user.role,
    campSession.id,
  );

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      sessionId: campSession.id,
      student: studentWhere,
      ...(status &&
      ["PENDING", "APPROVED", "DENIED", "CANCELLED"].includes(status)
        ? { status: status as LeaveRequestStatus }
        : {}),
    },
    include: leaveInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const canReviewAny = ADMIN_ROLES.includes(session.user.role);
  const shaped = [];
  for (const leave of leaves) {
    const canReview =
      canReviewAny ||
      (await canReviewLeaveRequest({
        userId: session.user.id,
        role: session.user.role,
        studentId: leave.studentId,
      }));
    shaped.push({ ...shapeLeave(leave), canReview });
  }

  return NextResponse.json({ leaves: shaped });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.STUDENT) {
    return NextResponse.json(
      { error: "Only students can submit leave requests" },
      { status: 403 },
    );
  }

  const student = await getLinkedStudentForUser(
    session.user.id,
    session.user.organizationId,
  );
  if (!student) {
    return NextResponse.json(
      { error: "No roster link for the active session" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const parsed = leaveRequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const activityIds = [...new Set(parsed.data.activityIds ?? [])];
  if (activityIds.length > 0) {
    const count = await prisma.activity.count({
      where: {
        id: { in: activityIds },
        sessionId: student.sessionId,
      },
    });
    if (count !== activityIds.length) {
      return NextResponse.json(
        { error: "One or more activities are invalid for this session" },
        { status: 400 },
      );
    }
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      sessionId: student.sessionId,
      studentId: student.id,
      requestedById: session.user.id,
      reason: parsed.data.reason.trim(),
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      activities: {
        create: activityIds.map((activityId) => ({ activityId })),
      },
    },
    include: leaveInclude,
  });

  return NextResponse.json({ leave: shapeLeave(leave) }, { status: 201 });
}
