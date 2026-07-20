import { prisma } from "@/lib/prisma";
import { ACTIVITY_COLOR_PALETTE, normalizeActivityColor } from "@/lib/schedule/activity-colors";

export type ActivityDistributionSlice = {
  /** Activity id, "general", or "not_checked_in" — used for Who's Here links */
  key: string;
  label: string;
  count: number;
  color: string;
};

const SLICE_COLORS = [...ACTIVITY_COLOR_PALETTE];

/**
 * Student counts by current open check-in activity for the active session.
 * Includes "General campus" (open check-in, no activity) and "Not checked in".
 * Each student is counted once (most recent open check-in wins).
 */
export async function getActivityDistribution(
  sessionId: string,
): Promise<{
  totalStudents: number;
  slices: ActivityDistributionSlice[];
  updatedAt: string;
}> {
  const [students, openCheckIns] = await Promise.all([
    prisma.student.findMany({
      where: { sessionId },
      select: { id: true },
    }),
    prisma.checkIn.findMany({
      where: {
        checkedOutAt: null,
        student: { sessionId },
      },
      select: {
        studentId: true,
        activityId: true,
        checkedInAt: true,
        activity: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { checkedInAt: "desc" },
    }),
  ]);

  const totalStudents = students.length;

  const latestByStudent = new Map<
    string,
    {
      activityId: string | null;
      activity: { id: string; name: string; color: string | null } | null;
    }
  >();

  for (const checkIn of openCheckIns) {
    if (!latestByStudent.has(checkIn.studentId)) {
      latestByStudent.set(checkIn.studentId, {
        activityId: checkIn.activityId,
        activity: checkIn.activity,
      });
    }
  }

  const byActivity = new Map<
    string,
    { label: string; count: number; color: string | null }
  >();
  let generalCount = 0;

  for (const row of latestByStudent.values()) {
    if (!row.activityId || !row.activity) {
      generalCount += 1;
      continue;
    }
    const existing = byActivity.get(row.activityId);
    if (existing) {
      existing.count += 1;
    } else {
      byActivity.set(row.activityId, {
        label: row.activity.name,
        count: 1,
        color: row.activity.color,
      });
    }
  }

  const notCheckedIn = totalStudents - latestByStudent.size;
  const slices: ActivityDistributionSlice[] = [];
  let colorIndex = 0;

  for (const [activityId, row] of byActivity) {
    slices.push({
      key: activityId,
      label: row.label,
      count: row.count,
      color: row.color
        ? normalizeActivityColor(row.color)
        : SLICE_COLORS[colorIndex % SLICE_COLORS.length],
    });
    colorIndex += 1;
  }

  slices.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (generalCount > 0) {
    slices.push({
      key: "general",
      label: "General campus",
      count: generalCount,
      color: "#2D6A4F",
    });
  }

  if (notCheckedIn > 0) {
    slices.push({
      key: "not_checked_in",
      label: "Not checked in",
      count: notCheckedIn,
      color: "#9CA3AF",
    });
  }

  return {
    totalStudents,
    slices,
    updatedAt: new Date().toISOString(),
  };
}
