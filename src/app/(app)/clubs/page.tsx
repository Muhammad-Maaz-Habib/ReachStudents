import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { STAFF_ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/design-system/page-header";
import { ClubsPanel, type ClubSummary } from "@/components/clubs/clubs-panel";

export default async function ClubsPage() {
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

  const [rawClubs, staffOptions, studentOptions] = activeSession
    ? await Promise.all([
        prisma.club.findMany({
          where: { sessionId: activeSession.id },
          include: {
            advisors: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, role: true },
                },
              },
              orderBy: { createdAt: "asc" },
            },
            memberships: {
              include: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    teamId: true,
                  },
                },
              },
            },
            _count: { select: { memberships: true, advisors: true } },
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
            team: { select: { name: true } },
            clubMemberships: { select: { clubId: true } },
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
      ])
    : [[], [], []];

  const initialClubs: ClubSummary[] = rawClubs.map((club) => ({
    id: club.id,
    sessionId: club.sessionId,
    name: club.name,
    advisors: club.advisors.map((row) => row.user),
    students: club.memberships.map((row) => row.student),
    _count: club._count,
  }));

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
        title="Clubs"
        description="Electives like Robotics or Debate — multiple advisors, students can join more than one."
      />
      <ClubsPanel
        canEdit={canEdit}
        sessions={sessionSummaries}
        initialSessionId={activeSession?.id ?? null}
        initialClubs={initialClubs}
        staffOptions={staffOptions}
        studentOptions={studentOptions}
      />
    </div>
  );
}
