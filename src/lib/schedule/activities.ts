import { prisma } from "@/lib/prisma";
import { buildActivityInstances } from "@/lib/schedule/recurrence";
import type { ActivitySeriesInput } from "@/lib/validations/activity";
import {
  nextActivityColor,
  normalizeActivityColor,
} from "@/lib/schedule/activity-colors";

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
