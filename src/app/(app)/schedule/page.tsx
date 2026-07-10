import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { ScheduleBuilder } from "@/components/schedule/schedule-builder";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  const campSession = await requireOrganizationSession(session.user.organizationId);
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

  const initialEvents = activities.map((activity) => ({
    id: activity.id,
    title: activity.name,
    start: activity.startTime.toISOString(),
    end: activity.endTime.toISOString(),
    backgroundColor: activity.color ?? "#E07A3A",
    borderColor: activity.color ?? "#E07A3A",
    extendedProps: {
      location: activity.location,
      teamName: activity.team?.name ?? null,
      overdueAlertMinutes: activity.overdueAlertMinutes,
      seriesId: activity.seriesId,
    },
  }));

  return (
    <ScheduleBuilder
      sessionName={campSession.name}
      sessionStart={campSession.startDate.toISOString().slice(0, 10)}
      sessionEnd={campSession.endDate.toISOString().slice(0, 10)}
      initialEvents={initialEvents}
      teams={teams}
      canEdit={canEdit}
    />
  );
}
