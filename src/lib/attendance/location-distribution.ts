import { prisma } from "@/lib/prisma";

/** Open check-in with no activity (matches donut "General campus"). */
export const GENERAL_LOCATION_KEY = "general";

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
  /** Normalized zone key (location, activity name, or GENERAL_LOCATION_KEY) */
  key: string;
  label: string;
  count: number;
  color: string;
  /** Activity ids currently contributing students to this zone */
  activityIds: string[];
};

/**
 * Zone label used by campus map — aligned with donut / Who's Here:
 * prefer Activity.location when set, otherwise Activity.name, else General campus.
 * (Donut slices by activity id+name; Who's Here shows name, with @ location if set.)
 */
export function resolveCampusZone(activity: {
  id: string;
  name: string;
  location: string | null;
} | null): { key: string; label: string } {
  if (!activity) {
    return { key: GENERAL_LOCATION_KEY, label: "General campus" };
  }
  const location = activity.location?.trim();
  if (location) {
    return { key: location.toLowerCase(), label: location };
  }
  const name = activity.name.trim();
  if (name) {
    return { key: name.toLowerCase(), label: name };
  }
  return { key: GENERAL_LOCATION_KEY, label: "General campus" };
}

function colorForLocationKey(key: string) {
  if (key === GENERAL_LOCATION_KEY) return "#1B4332";
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return ZONE_COLORS[hash % ZONE_COLORS.length];
}

/**
 * Student headcount by campus zone for open check-ins.
 * Same attendance definition as the dashboard donut (latest open check-in per student).
 * Does not use GPS.
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
      select: { id: true, name: true, location: true },
    }),
  ]);

  const totalStudents = students.length;

  const latestByStudent = new Map<
    string,
    {
      activityId: string | null;
      activity: { id: string; name: string; location: string | null } | null;
    }
  >();

  for (const checkIn of openCheckIns) {
    if (latestByStudent.has(checkIn.studentId)) continue;
    latestByStudent.set(checkIn.studentId, {
      activityId: checkIn.activityId,
      activity: checkIn.activity,
    });
  }

  const byZone = new Map<
    string,
    {
      label: string;
      count: number;
      activityIds: Set<string>;
    }
  >();

  // Seed zones from schedule activities so empty campus spots still appear.
  for (const activity of activities) {
    const zone = resolveCampusZone(activity);
    if (zone.key === GENERAL_LOCATION_KEY) continue;
    if (!byZone.has(zone.key)) {
      byZone.set(zone.key, {
        label: zone.label,
        count: 0,
        activityIds: new Set(),
      });
    }
    byZone.get(zone.key)!.activityIds.add(activity.id);
  }

  let generalCount = 0;

  for (const row of latestByStudent.values()) {
    const zone = resolveCampusZone(row.activity);
    if (zone.key === GENERAL_LOCATION_KEY) {
      generalCount += 1;
      continue;
    }
    const existing = byZone.get(zone.key);
    if (existing) {
      existing.count += 1;
      if (row.activityId) existing.activityIds.add(row.activityId);
    } else {
      byZone.set(zone.key, {
        label: zone.label,
        count: 1,
        activityIds: new Set(row.activityId ? [row.activityId] : []),
      });
    }
  }

  const slices: LocationDistributionSlice[] = [...byZone.entries()].map(
    ([key, row]) => ({
      key,
      label: row.label,
      count: row.count,
      color: colorForLocationKey(key),
      activityIds: [...row.activityIds],
    }),
  );

  slices.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (generalCount > 0) {
    slices.push({
      key: GENERAL_LOCATION_KEY,
      label: "General campus",
      count: generalCount,
      color: colorForLocationKey(GENERAL_LOCATION_KEY),
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

/** @deprecated Use GENERAL_LOCATION_KEY — kept for older query links. */
export const UNKNOWN_LOCATION_KEY = "__unknown__";
