import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultChatChannels } from "@/lib/messaging/chat";

export type CloneStructureSummary = {
  sourceSessionId: string;
  targetSessionId: string;
  cloned: {
    teams: number;
    teamStaffAssignments: number;
    mentorGroups: number;
    clubs: number;
    clubAdvisors: number;
    activitySeries: number;
    activities: number;
    excursions: number;
    staffShifts: number;
    forms: number;
  };
};

function shiftDate(value: Date, offsetMs: number) {
  return new Date(value.getTime() + offsetMs);
}

function shiftNullableDate(value: Date | null | undefined, offsetMs: number) {
  if (!value) return value ?? null;
  return shiftDate(value, offsetMs);
}

/**
 * Copy program structure from one session into another (empty of students).
 * Dates on schedule-like rows are shifted by (target.start − source.start).
 * Does not copy students, check-ins, incidents, submissions, messages, or GPS.
 */
export async function cloneSessionStructure({
  organizationId,
  sourceSessionId,
  targetSessionId,
}: {
  organizationId: string;
  sourceSessionId: string;
  targetSessionId: string;
}): Promise<CloneStructureSummary> {
  if (sourceSessionId === targetSessionId) {
    throw new Error("Cannot copy structure from a session onto itself");
  }

  const [source, target] = await Promise.all([
    prisma.campSession.findFirst({
      where: { id: sourceSessionId, organizationId },
    }),
    prisma.campSession.findFirst({
      where: { id: targetSessionId, organizationId },
    }),
  ]);

  if (!source || !target) {
    throw new Error("Source or target session not found");
  }

  const offsetMs = target.startDate.getTime() - source.startDate.getTime();

  const summary = await prisma.$transaction(async (tx) => {
    const teamIdMap = new Map<string, string>();
    const seriesIdMap = new Map<string, string>();
    const counts = {
      teams: 0,
      teamStaffAssignments: 0,
      mentorGroups: 0,
      clubs: 0,
      clubAdvisors: 0,
      activitySeries: 0,
      activities: 0,
      excursions: 0,
      staffShifts: 0,
      forms: 0,
    };

    const sourceTeams = await tx.team.findMany({
      where: { sessionId: sourceSessionId },
      include: { staff: true },
      orderBy: { name: "asc" },
    });

    for (const team of sourceTeams) {
      const created = await tx.team.create({
        data: {
          sessionId: targetSessionId,
          name: team.name,
          color: team.color,
        },
      });
      teamIdMap.set(team.id, created.id);
      counts.teams += 1;

      if (team.staff.length > 0) {
        await tx.teamStaffAssignment.createMany({
          data: team.staff.map((row) => ({
            teamId: created.id,
            userId: row.userId,
            isLead: row.isLead,
          })),
        });
        counts.teamStaffAssignments += team.staff.length;
      }
    }

    const sourceMentorGroups = await tx.mentorGroup.findMany({
      where: { sessionId: sourceSessionId },
      orderBy: { name: "asc" },
    });
    for (const group of sourceMentorGroups) {
      await tx.mentorGroup.create({
        data: {
          sessionId: targetSessionId,
          name: group.name,
          mentorId: group.mentorId,
        },
      });
      counts.mentorGroups += 1;
    }

    const sourceClubs = await tx.club.findMany({
      where: { sessionId: sourceSessionId },
      include: { advisors: true },
      orderBy: { name: "asc" },
    });
    for (const club of sourceClubs) {
      const created = await tx.club.create({
        data: {
          sessionId: targetSessionId,
          name: club.name,
          advisors: {
            create: club.advisors.map((row) => ({ userId: row.userId })),
          },
        },
      });
      counts.clubs += 1;
      counts.clubAdvisors += club.advisors.length;
      void created;
    }

    const sourceSeries = await tx.activitySeries.findMany({
      where: { sessionId: sourceSessionId },
      orderBy: { name: "asc" },
    });
    for (const series of sourceSeries) {
      const created = await tx.activitySeries.create({
        data: {
          sessionId: targetSessionId,
          name: series.name,
          description: series.description,
          location: series.location,
          color: series.color,
          capacity: series.capacity,
          teamId: series.teamId ? (teamIdMap.get(series.teamId) ?? null) : null,
          recurrenceDays: series.recurrenceDays,
          startTimeMinutes: series.startTimeMinutes,
          durationMinutes: series.durationMinutes,
          rangeStart: shiftDate(series.rangeStart, offsetMs),
          rangeEnd: shiftDate(series.rangeEnd, offsetMs),
          overdueAlertMinutes: series.overdueAlertMinutes,
        },
      });
      seriesIdMap.set(series.id, created.id);
      counts.activitySeries += 1;
    }

    const sourceActivities = await tx.activity.findMany({
      where: { sessionId: sourceSessionId },
      orderBy: { startTime: "asc" },
    });
    for (const activity of sourceActivities) {
      await tx.activity.create({
        data: {
          sessionId: targetSessionId,
          seriesId: activity.seriesId
            ? (seriesIdMap.get(activity.seriesId) ?? null)
            : null,
          name: activity.name,
          description: activity.description,
          location: activity.location,
          capacity: activity.capacity,
          startTime: shiftDate(activity.startTime, offsetMs),
          endTime: shiftDate(activity.endTime, offsetMs),
          isOpenEnded: activity.isOpenEnded,
          color: activity.color,
          teamId: activity.teamId
            ? (teamIdMap.get(activity.teamId) ?? null)
            : null,
          overdueAlertMinutes: activity.overdueAlertMinutes,
        },
      });
      counts.activities += 1;
    }

    const sourceExcursions = await tx.excursion.findMany({
      where: { sessionId: sourceSessionId },
      orderBy: { startTime: "asc" },
    });
    for (const excursion of sourceExcursions) {
      await tx.excursion.create({
        data: {
          sessionId: targetSessionId,
          name: excursion.name,
          destination: excursion.destination,
          notes: excursion.notes,
          capacity: excursion.capacity,
          startTime: shiftDate(excursion.startTime, offsetMs),
          endTime: shiftDate(excursion.endTime, offsetMs),
        },
      });
      counts.excursions += 1;
    }

    const sourceShifts = await tx.staffShift.findMany({
      where: { sessionId: sourceSessionId },
      orderBy: { date: "asc" },
    });
    for (const shift of sourceShifts) {
      await tx.staffShift.create({
        data: {
          sessionId: targetSessionId,
          userId: shift.userId,
          date: shiftDate(shift.date, offsetMs),
          dutyLabel: shift.dutyLabel,
          roleOnDuty: shift.roleOnDuty,
          requiredCertification: shift.requiredCertification,
          startTime: shiftNullableDate(shift.startTime, offsetMs),
          endTime: shiftNullableDate(shift.endTime, offsetMs),
        },
      });
      counts.staffShifts += 1;
    }

    const sourceForms = await tx.form.findMany({
      where: { sessionId: sourceSessionId },
      orderBy: { title: "asc" },
    });
    for (const form of sourceForms) {
      await tx.form.create({
        data: {
          organizationId,
          sessionId: targetSessionId,
          title: form.title,
          type: form.type,
          description: form.description,
          fields: form.fields as Prisma.InputJsonValue,
          deadline: shiftNullableDate(form.deadline, offsetMs),
          isActive: form.isActive,
        },
      });
      counts.forms += 1;
    }

    return counts;
  });

  await ensureDefaultChatChannels(organizationId, targetSessionId);

  return {
    sourceSessionId,
    targetSessionId,
    cloned: summary,
  };
}
