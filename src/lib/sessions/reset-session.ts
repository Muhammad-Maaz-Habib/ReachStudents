import { prisma } from "@/lib/prisma";
import { ensureDefaultChatChannels } from "@/lib/messaging/chat";

export type SessionResetSummary = {
  sessionId: string;
  deleted: {
    students: number;
    activities: number;
    activitySeries: number;
    forms: number;
    announcements: number;
    incidents: number;
    staffShifts: number;
    shiftSwaps: number;
    leaveRequests: number;
    tripLocationCheckIns: number;
    chatChannels: number;
  };
  preserved: {
    teams: number;
    mentorGroups: number;
    clubs: number;
    excursions: number;
  };
};

/**
 * Wipe operational / student-linked data for a session while keeping the
 * CampSession row and program structure (Teams, Mentor Groups, Clubs + advisors,
 * Excursions). Deletes on-campus Activities so the calendar is not stale.
 * Org-level form templates (`sessionId: null`) are not touched.
 */
export async function resetCampSessionOperationalData(
  organizationId: string,
  sessionId: string,
): Promise<SessionResetSummary> {
  const campSession = await prisma.campSession.findFirst({
    where: { id: sessionId, organizationId },
    include: {
      _count: {
        select: {
          teams: true,
          mentorGroups: true,
          clubs: true,
          excursions: true,
        },
      },
    },
  });
  if (!campSession) {
    throw new Error("Session not found");
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const shiftSwaps = await tx.shiftSwapRequest.deleteMany({
      where: { sessionId },
    });
    const staffShifts = await tx.staffShift.deleteMany({ where: { sessionId } });
    const leaveRequests = await tx.leaveRequest.deleteMany({
      where: { sessionId },
    });
    const chatChannels = await tx.chatChannel.deleteMany({
      where: { sessionId },
    });
    const announcements = await tx.announcement.deleteMany({
      where: { sessionId },
    });
    const forms = await tx.form.deleteMany({ where: { sessionId } });
    const incidents = await tx.incidentReport.deleteMany({
      where: { sessionId },
    });
    const tripLocationCheckIns = await tx.tripLocationCheckIn.deleteMany({
      where: { sessionId },
    });
    const students = await tx.student.deleteMany({ where: { sessionId } });
    const activities = await tx.activity.deleteMany({ where: { sessionId } });
    const activitySeries = await tx.activitySeries.deleteMany({
      where: { sessionId },
    });

    return {
      students: students.count,
      activities: activities.count,
      activitySeries: activitySeries.count,
      forms: forms.count,
      announcements: announcements.count,
      incidents: incidents.count,
      staffShifts: staffShifts.count,
      shiftSwaps: shiftSwaps.count,
      leaveRequests: leaveRequests.count,
      tripLocationCheckIns: tripLocationCheckIns.count,
      chatChannels: chatChannels.count,
    };
  });

  await ensureDefaultChatChannels(organizationId, sessionId);

  return {
    sessionId,
    deleted,
    preserved: {
      teams: campSession._count.teams,
      mentorGroups: campSession._count.mentorGroups,
      clubs: campSession._count.clubs,
      excursions: campSession._count.excursions,
    },
  };
}
