import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { colorForActivity } from "@/lib/schedule/activity-colors";
import { ensureSessionActivityColors } from "@/lib/attendance/activity-distribution";
import { activityCalendarDisplay } from "@/lib/validations/activity";
import { ScheduleBuilder } from "@/components/schedule/schedule-builder";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  const campSession = await requireOrganizationSession(session.user.organizationId);
  await ensureSessionActivityColors(campSession.id);

  const [canEdit, activities, teams] = await Promise.all([
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.SCHEDULES,
      "edit",
    ),
    prisma.activity.findMany({
      where: { sessionId: campSession.id },
      include: { team: { select: { name: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.team.findMany({
      where: { sessionId: campSession.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canImportCsv = ADMIN_ROLES.includes(session.user.role);
  const initialEvents = activities.map((activity) => {
    const color = colorForActivity(activity.id, activity.color);
    const display = activityCalendarDisplay({
      name: activity.name,
      startTime: activity.startTime,
      endTime: activity.endTime,
      isOpenEnded: activity.isOpenEnded,
    });
    return {
      id: activity.id,
      title: display.title,
      start: display.start.toISOString(),
      end: display.end.toISOString(),
      backgroundColor: color,
      borderColor: color,
      textColor: "#ffffff",
      extendedProps: {
        location: activity.location,
        teamName: activity.team?.name ?? null,
        overdueAlertMinutes: activity.overdueAlertMinutes,
        seriesId: activity.seriesId,
        color,
        isOpenEnded: activity.isOpenEnded,
      },
    };
  });

  return (
    <ScheduleBuilder
      sessionName={campSession.name}
      sessionStart={campSession.startDate.toISOString().slice(0, 10)}
      sessionEnd={campSession.endDate.toISOString().slice(0, 10)}
      initialEvents={initialEvents}
      teams={teams}
      canEdit={canEdit}
      canImportCsv={canImportCsv}
    />
  );
}
