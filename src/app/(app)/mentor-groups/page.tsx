import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { STAFF_ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/design-system/page-header";
import { MentorGroupsPanel } from "@/components/mentor-groups/mentor-groups-panel";

export default async function MentorGroupsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/onboarding");
  }

  const [canView, canEdit] = await Promise.all([
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.SETTINGS,
      "view",
    ),
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.SETTINGS,
      "edit",
    ),
  ]);

  if (!canView) {
    redirect("/dashboard");
  }

  const sessions = await prisma.campSession.findMany({
    where: { organizationId: session.user.organizationId },
    include: { _count: { select: { teams: true, students: true } } },
    orderBy: { startDate: "desc" },
  });

  const activeSession =
    sessions.find((row) => row.isActive) ?? sessions[0] ?? null;

  const [initialGroups, staffOptions, studentOptions] = activeSession
    ? await Promise.all([
        prisma.mentorGroup.findMany({
          where: { sessionId: activeSession.id },
          include: {
            mentor: {
              select: { id: true, name: true, email: true, role: true },
            },
            students: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                teamId: true,
              },
              orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            },
            _count: { select: { students: true } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: {
            organizationId: session.user.organizationId,
            isActive: true,
            role: { in: STAFF_ROLES },
          },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" },
        }),
        prisma.student.findMany({
          where: { sessionId: activeSession.id },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mentorGroupId: true,
            team: { select: { name: true } },
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
      ])
    : [[], [], []];

  const sessionSummaries = sessions.map((campSession) => ({
    id: campSession.id,
    name: campSession.name,
    description: campSession.description,
    startDate: campSession.startDate.toISOString(),
    endDate: campSession.endDate.toISOString(),
    isActive: campSession.isActive,
    _count: campSession._count,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mentor Groups"
        description="Day-to-day cohorts with one assigned mentor. Independent from academic teams and programs."
      />
      <MentorGroupsPanel
        canEdit={canEdit}
        sessions={sessionSummaries}
        initialSessionId={activeSession?.id ?? null}
        initialGroups={initialGroups}
        staffOptions={staffOptions}
        studentOptions={studentOptions}
      />
    </div>
  );
}
