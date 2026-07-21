import { prisma } from "@/lib/prisma";
import {
  colorForActivity,
  nextActivityColor,
} from "@/lib/schedule/activity-colors";

/** Reserved for non-activity slices so they don't collide with the palette. */
const GENERAL_CAMPUS_COLOR = "#1B4332";
const NOT_CHECKED_IN_COLOR = "#9CA3AF";

/**
 * Persist a distinct palette color on each activity in the session when
 * color is missing or duplicated, so dashboard + schedule stay in sync.
 */
export async function ensureSessionActivityColors(sessionId: string) {
  const activities = await prisma.activity.findMany({
    where: { sessionId },
    select: { id: true, color: true },
    orderBy: { startTime: "asc" },
  });

  const assigned: string[] = [];
  const updates: { id: string; color: string }[] = [];

  for (const activity of activities) {
    const current = activity.color?.toUpperCase() ?? null;
    const valid =
      !!activity.color && /^#[0-9A-Fa-f]{6}$/.test(activity.color);
    const duplicate = current !== null && assigned.includes(current);

    if (valid && !duplicate) {
      assigned.push(current!);
      continue;
    }

    const color = nextActivityColor(assigned);
    assigned.push(color.toUpperCase());
    updates.push({ id: activity.id, color });
  }

  await Promise.all(
    updates.map((row) =>
      prisma.activity.update({
        where: { id: row.id },
        data: { color: row.color },
      }),
    ),
  );

  return updates.length;
}

export type ActivityDistributionSlice = {
  /** Activity id, "general", or "not_checked_in" — used for Who's Here links */
  key: string;
  label: string;
  count: number;
  color: string;
};

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
  await ensureSessionActivityColors(sessionId);

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

  for (const [activityId, row] of byActivity) {
    slices.push({
      key: activityId,
      label: row.label,
      count: row.count,
      // Prefer Activity.color (same as /schedule); fall back to id-stable palette.
      color: colorForActivity(activityId, row.color),
    });
  }

  slices.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (generalCount > 0) {
    slices.push({
      key: "general",
      label: "General campus",
      count: generalCount,
      color: GENERAL_CAMPUS_COLOR,
    });
  }

  if (notCheckedIn > 0) {
    slices.push({
      key: "not_checked_in",
      label: "Not checked in",
      count: notCheckedIn,
      color: NOT_CHECKED_IN_COLOR,
    });
  }

  return {
    totalStudents,
    slices,
    updatedAt: new Date().toISOString(),
  };
}
