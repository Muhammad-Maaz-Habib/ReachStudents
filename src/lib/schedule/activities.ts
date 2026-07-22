import { prisma } from "@/lib/prisma";
import { buildActivityInstances } from "@/lib/schedule/recurrence";
import type { ActivitySeriesInput } from "@/lib/validations/activity";
import {
  nextActivityColor,
  normalizeActivityColor,
} from "@/lib/schedule/activity-colors";
import {
  parseRecurrenceDays,
  parseScheduleDate,
  parseStartTimeMinutes,
  type ScheduleCsvRow,
} from "@/lib/csv/schedule-import";
import type { ActivityDeleteScope } from "@/lib/schedule/activity-delete";

export type { ActivityDeleteScope };
export type OneOffActivityInput = {
  name: string;
  description?: string;
  location?: string;
  capacity?: number;
  color?: string;
  teamId?: string | null;
  startTime: Date;
  endTime: Date;
  isOpenEnded?: boolean;
  overdueAlertMinutes?: number;
};

export async function createOneOffActivity(
  sessionId: string,
  input: OneOffActivityInput,
) {
  const existingColors = await prisma.activity.findMany({
    where: { sessionId },
    select: { color: true },
  });
  const color = normalizeActivityColor(
    input.color ?? nextActivityColor(existingColors.map((row) => row.color)),
  );

  const activity = await prisma.activity.create({
    data: {
      sessionId,
      name: input.name,
      description: input.description,
      location: input.location,
      capacity: input.capacity ?? null,
      color,
      teamId: input.teamId || null,
      startTime: input.startTime,
      endTime: input.endTime,
      isOpenEnded: Boolean(input.isOpenEnded),
      overdueAlertMinutes: input.overdueAlertMinutes ?? 15,
    },
  });

  if (input.teamId) {
    await assignTeamToActivity(activity.id, input.teamId);
  }

  return activity;
}

export async function createActivitySeries(
  sessionId: string,
  input: ActivitySeriesInput,
) {
  const existingColors = await prisma.activity.findMany({
    where: { sessionId },
    select: { color: true },
  });
  const color = normalizeActivityColor(
    input.color ?? nextActivityColor(existingColors.map((row) => row.color)),
  );

  const series = await prisma.activitySeries.create({
    data: {
      sessionId,
      name: input.name,
      description: input.description,
      location: input.location,
      color,
      capacity: input.capacity,
      teamId: input.teamId || null,
      recurrenceDays: input.recurrenceDays,
      startTimeMinutes: input.startTimeMinutes,
      durationMinutes: input.durationMinutes,
      rangeStart: new Date(input.rangeStart),
      rangeEnd: new Date(input.rangeEnd),
      overdueAlertMinutes: input.overdueAlertMinutes,
    },
  });

  const instances = buildActivityInstances({
    rangeStart: series.rangeStart,
    rangeEnd: series.rangeEnd,
    recurrenceDays: series.recurrenceDays,
    startTimeMinutes: series.startTimeMinutes,
    durationMinutes: series.durationMinutes,
  });

  if (instances.length === 0) {
    return { series, activities: [] };
  }

  const activities = await prisma.$transaction(
    instances.map((instance) =>
      prisma.activity.create({
        data: {
          sessionId,
          seriesId: series.id,
          name: series.name,
          description: series.description,
          location: series.location,
          color: series.color,
          capacity: series.capacity,
          teamId: series.teamId,
          overdueAlertMinutes: series.overdueAlertMinutes,
          startTime: instance.startTime,
          endTime: instance.endTime,
          ...(series.teamId
            ? {
                schedules: {
                  create: { teamId: series.teamId },
                },
              }
            : {}),
        },
      }),
    ),
  );

  return { series, activities };
}

export async function assignTeamToActivity(activityId: string, teamId: string) {
  await prisma.schedule.deleteMany({ where: { activityId } });
  return prisma.schedule.create({
    data: { activityId, teamId },
  });
}

export type ImportScheduleResult = {
  action: "created_one_off" | "created_series";
  activityIds: string[];
  seriesId?: string;
  instanceCount: number;
};

/**
 * Creates a one-off Activity or an ActivitySeries from a CSV row.
 * Reuses createOneOffActivity / createActivitySeries.
 */
export async function importScheduleRecord({
  sessionId,
  sessionEndDate,
  teams,
  data,
}: {
  sessionId: string;
  sessionEndDate: Date;
  teams: { id: string; name: string }[];
  data: ScheduleCsvRow;
}): Promise<ImportScheduleResult> {
  const startDate = parseScheduleDate(data.start_date);
  if (!startDate) {
    throw new Error(`Invalid start_date "${data.start_date}" (use YYYY-MM-DD)`);
  }

  const startTimeMinutes = parseStartTimeMinutes(data.start_time);
  if (startTimeMinutes === null) {
    throw new Error(
      `Invalid start_time "${data.start_time}" (use HH:MM or H:MM AM/PM)`,
    );
  }

  const durationMinutes = Number(data.duration_minutes);
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 15 ||
    durationMinutes > 8 * 60
  ) {
    throw new Error(
      `duration_minutes must be an integer between 15 and 480 (got "${data.duration_minutes}")`,
    );
  }

  let overdueAlertMinutes = 15;
  if (data.overdue_alert_minutes?.trim()) {
    overdueAlertMinutes = Number(data.overdue_alert_minutes);
    if (
      !Number.isInteger(overdueAlertMinutes) ||
      overdueAlertMinutes < 0 ||
      overdueAlertMinutes > 120
    ) {
      throw new Error(
        `overdue_alert_minutes must be an integer 0–120 (got "${data.overdue_alert_minutes}")`,
      );
    }
  }

  let teamId: string | null = null;
  if (data.team?.trim()) {
    const team = teams.find(
      (entry) => entry.name.toLowerCase() === data.team!.trim().toLowerCase(),
    );
    if (!team) {
      throw new Error(`Unknown team "${data.team.trim()}"`);
    }
    teamId = team.id;
  }

  let recurrenceDays: number[] | null = null;
  try {
    recurrenceDays = parseRecurrenceDays(data.recurrence_days);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Invalid recurrence_days");
  }

  if (recurrenceDays && recurrenceDays.length > 0) {
    const rangeEndIso = sessionEndDate.toISOString().slice(0, 10);
    const rangeStartIso = data.start_date.trim();

    const result = await createActivitySeries(sessionId, {
      name: data.activity_name.trim(),
      teamId: teamId || undefined,
      recurrenceDays,
      startTimeMinutes,
      durationMinutes,
      rangeStart: rangeStartIso,
      rangeEnd: rangeEndIso,
      overdueAlertMinutes,
    });

    if (result.activities.length === 0) {
      throw new Error(
        `No instances generated for "${data.activity_name}" between ${rangeStartIso} and ${rangeEndIso} on the given recurrence_days`,
      );
    }

    return {
      action: "created_series",
      activityIds: result.activities.map((activity) => activity.id),
      seriesId: result.series.id,
      instanceCount: result.activities.length,
    };
  }

  const startTime = new Date(startDate);
  startTime.setUTCHours(
    Math.floor(startTimeMinutes / 60),
    startTimeMinutes % 60,
    0,
    0,
  );
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const activity = await createOneOffActivity(sessionId, {
    name: data.activity_name.trim(),
    teamId,
    startTime,
    endTime,
    overdueAlertMinutes,
  });

  return {
    action: "created_one_off",
    activityIds: [activity.id],
    instanceCount: 1,
  };
}

export type ActivityDeleteImpact = {
  scope: ActivityDeleteScope;
  activityIds: string[];
  activityCount: number;
  checkInCount: number;
  seriesId: string | null;
  activityName: string;
};

async function resolveDeleteTargets(
  sessionId: string,
  activityId: string,
  scope: ActivityDeleteScope,
): Promise<ActivityDeleteImpact> {
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, sessionId },
  });
  if (!activity) {
    throw new Error("Activity not found");
  }

  let activityIds: string[] = [activity.id];

  if (scope !== "instance") {
    if (!activity.seriesId) {
      throw new Error("This activity is not part of a recurring series");
    }

    if (scope === "future") {
      const future = await prisma.activity.findMany({
        where: {
          sessionId,
          seriesId: activity.seriesId,
          startTime: { gte: activity.startTime },
        },
        select: { id: true },
      });
      activityIds = future.map((row) => row.id);
    } else {
      const all = await prisma.activity.findMany({
        where: { sessionId, seriesId: activity.seriesId },
        select: { id: true },
      });
      activityIds = all.map((row) => row.id);
    }
  }

  const checkInCount = await prisma.checkIn.count({
    where: { activityId: { in: activityIds } },
  });

  return {
    scope,
    activityIds,
    activityCount: activityIds.length,
    checkInCount,
    seriesId: activity.seriesId,
    activityName: activity.name,
  };
}

export async function getActivityDeleteImpact(
  sessionId: string,
  activityId: string,
  scope: ActivityDeleteScope,
) {
  return resolveDeleteTargets(sessionId, activityId, scope);
}

/**
 * Hard-deletes activity instance(s). Check-ins are preserved with activityId
 * cleared (schema onDelete: SetNull). Schedules and missing-alert dispatches cascade.
 */
export async function deleteActivities(
  sessionId: string,
  activityId: string,
  scope: ActivityDeleteScope,
) {
  const impact = await resolveDeleteTargets(sessionId, activityId, scope);

  await prisma.activity.deleteMany({
    where: { id: { in: impact.activityIds }, sessionId },
  });

  if (impact.seriesId) {
    const remaining = await prisma.activity.count({
      where: { sessionId, seriesId: impact.seriesId },
    });
    if (remaining === 0 || scope === "series") {
      await prisma.activitySeries.deleteMany({
        where: { id: impact.seriesId, sessionId },
      });
    }
  }

  return impact;
}
