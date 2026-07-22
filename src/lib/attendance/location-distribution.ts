import { prisma } from "@/lib/prisma";

/** URL/query key for open check-ins with no usable Activity.location */
export const UNKNOWN_LOCATION_KEY = "__unknown__";

const ZONE_COLORS = [
  "#2D6A4F",
  "#E07A3A",
  "#457B9D",
  "#BC6C25",
  "#1B4332",
  "#6A994E",
  "#9B2226",
  "#005F73",
];

export type LocationDistributionSlice = {
  /** Normalized location key, or UNKNOWN_LOCATION_KEY */
  key: string;
  label: string;
  count: number;
  color: string;
  /** Activity ids currently contributing students to this zone */
  activityIds: string[];
};

function normalizeLocationKey(raw: string | null | undefined) {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function displayLocation(raw: string) {
  return raw.trim();
}

function colorForLocationKey(key: string) {
  if (key === UNKNOWN_LOCATION_KEY) return "#6B7280";
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return ZONE_COLORS[hash % ZONE_COLORS.length];
}

/**
 * Student headcount by Activity.location for open check-ins.
 * Same attendance definition as the dashboard donut (latest open check-in per student).
 * Does not use GPS — location comes only from the activity the student checked into.
 */
export async function getLocationDistribution(sessionId: string): Promise<{
  totalStudents: number;
  checkedInCount: number;
  slices: LocationDistributionSlice[];
  updatedAt: string;
}> {
  const [students, openCheckIns, activities] = await Promise.all([
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
          select: { id: true, name: true, location: true },
        },
      },
      orderBy: { checkedInAt: "desc" },
    }),
    prisma.activity.findMany({
      where: { sessionId },
      select: { id: true, location: true },
    }),
  ]);

  const totalStudents = students.length;

  const latestByStudent = new Map<
    string,
    {
      activityId: string | null;
      location: string | null;
    }
  >();

  for (const checkIn of openCheckIns) {
    if (latestByStudent.has(checkIn.studentId)) continue;
    latestByStudent.set(checkIn.studentId, {
      activityId: checkIn.activityId,
      location: checkIn.activity?.location ?? null,
    });
  }

  const byLocation = new Map<
    string,
    {
      label: string;
      count: number;
      activityIds: Set<string>;
    }
  >();

  // Seed zones from named activity locations so the campus map shows the layout
  // even when a zone currently has zero students.
  for (const activity of activities) {
    const key = normalizeLocationKey(activity.location);
    if (!key || !activity.location) continue;
    if (!byLocation.has(key)) {
      byLocation.set(key, {
        label: displayLocation(activity.location),
        count: 0,
        activityIds: new Set(),
      });
    }
    byLocation.get(key)!.activityIds.add(activity.id);
  }

  let unknownCount = 0;

  for (const row of latestByStudent.values()) {
    const key = normalizeLocationKey(row.location);
    if (!key || !row.location?.trim()) {
      unknownCount += 1;
      continue;
    }
    const existing = byLocation.get(key);
    if (existing) {
      existing.count += 1;
      if (row.activityId) existing.activityIds.add(row.activityId);
    } else {
      byLocation.set(key, {
        label: displayLocation(row.location),
        count: 1,
        activityIds: new Set(row.activityId ? [row.activityId] : []),
      });
    }
  }

  const slices: LocationDistributionSlice[] = [...byLocation.entries()].map(
    ([key, row]) => ({
      key,
      label: row.label,
      count: row.count,
      color: colorForLocationKey(key),
      activityIds: [...row.activityIds],
    }),
  );

  slices.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (unknownCount > 0) {
    slices.push({
      key: UNKNOWN_LOCATION_KEY,
      label: "No location set",
      count: unknownCount,
      color: colorForLocationKey(UNKNOWN_LOCATION_KEY),
      activityIds: [],
    });
  }

  return {
    totalStudents,
    checkedInCount: latestByStudent.size,
    slices,
    updatedAt: new Date().toISOString(),
  };
}
