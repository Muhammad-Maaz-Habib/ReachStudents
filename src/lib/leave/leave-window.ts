import { LeaveRequestStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Approved leave overlapping [rangeStart, rangeEnd] (inclusive overlap). */
export async function getApprovedLeaveStudentIds({
  sessionId,
  rangeStart,
  rangeEnd,
  activityId,
}: {
  sessionId: string;
  rangeStart: Date;
  rangeEnd: Date;
  /** When set, only leaves that apply to all activities or this activity. */
  activityId?: string;
}): Promise<Set<string>> {
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      sessionId,
      status: LeaveRequestStatus.APPROVED,
      startsAt: { lte: rangeEnd },
      endsAt: { gte: rangeStart },
    },
    select: {
      studentId: true,
      activities: { select: { activityId: true } },
    },
  });

  const ids = new Set<string>();
  for (const leave of leaves) {
    if (leave.activities.length === 0) {
      ids.add(leave.studentId);
      continue;
    }
    if (activityId && leave.activities.some((row) => row.activityId === activityId)) {
      ids.add(leave.studentId);
    }
  }
  return ids;
}

/** Students currently on approved leave (window contains `now`). */
export async function getStudentsOnLeaveNow(
  sessionId: string,
  now = new Date(),
): Promise<Set<string>> {
  return getApprovedLeaveStudentIds({
    sessionId,
    rangeStart: now,
    rangeEnd: now,
  });
}
