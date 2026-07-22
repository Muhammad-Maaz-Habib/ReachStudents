import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource, UserRole } from "@/generated/prisma/browser";
import { PageHeader } from "@/components/design-system/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionMatrixEditor } from "@/components/settings/permission-matrix-editor";
import { DataRetentionPanel } from "@/components/settings/data-retention-panel";
import { SessionsPanel } from "@/components/settings/sessions-panel";
import { TeamsPanel } from "@/components/settings/teams-panel";
import { MentorGroupsPanel } from "@/components/settings/mentor-groups-panel";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { STAFF_ROLES } from "@/lib/constants";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/onboarding");
  }

  const [canViewSettings, canEditSettings, organization, sessions, permissions] =
    await Promise.all([
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
      prisma.organization.findUnique({
        where: { id: session.user.organizationId },
      }),
      prisma.campSession.findMany({
        where: { organizationId: session.user.organizationId },
        include: { _count: { select: { teams: true, students: true } } },
        orderBy: { startDate: "desc" },
      }),
      prisma.permissionMatrix.findMany({
        where: { organizationId: session.user.organizationId },
        orderBy: [{ role: "asc" }, { resource: "asc" }],
      }),
    ]);

  if (!canViewSettings) redirect("/dashboard");

  const activeSession =
    sessions.find((row) => row.isActive) ?? sessions[0] ?? null;

  const initialTeams = activeSession
    ? await prisma.team.findMany({
        where: { sessionId: activeSession.id },
        include: {
          students: {
            select: { id: true, firstName: true, lastName: true },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          },
          staff: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { students: true, staff: true } },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const [initialMentorGroups, mentorStaffOptions, mentorStudentOptions] =
    activeSession
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
        title="Settings"
        description="Organization profile, sessions, teams, mentor groups, and permission matrix."
      />

      <Card id="account" className="rounded-2xl scroll-mt-6">
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Change the password for{" "}
            <span className="font-medium text-foreground">
              {session.user.email}
            </span>
            . Staff without Settings access can also use{" "}
            <Link href="/account" className="underline underline-offset-2">
              Account
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm mode="voluntary" />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{organization?.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Slug</span>
            <span className="font-medium">{organization?.slug}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Brand colors</span>
            <div className="flex gap-2">
              <span
                className="size-6 rounded-full border"
                style={{ backgroundColor: organization?.primaryColor }}
                title="Primary"
              />
              <span
                className="size-6 rounded-full border"
                style={{ backgroundColor: organization?.secondaryColor }}
                title="Secondary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SessionsPanel canEdit={canEditSettings} initialSessions={sessionSummaries} />
        <TeamsPanel
          canEdit={canEditSettings}
          sessions={sessionSummaries}
          initialSessionId={activeSession?.id ?? null}
          initialTeams={initialTeams}
        />
      </div>

      <MentorGroupsPanel
        canEdit={canEditSettings}
        sessions={sessionSummaries}
        initialSessionId={activeSession?.id ?? null}
        initialGroups={initialMentorGroups}
        staffOptions={mentorStaffOptions}
        studentOptions={mentorStudentOptions}
      />

      <DataRetentionPanel
        canEdit={canEditSettings}
        initialPolicy={organization?.sessionDataRetentionPolicy ?? "NONE"}
        initialDaysAfterEnd={organization?.sessionDataRetentionDaysAfterEnd ?? 90}
      />

      <PermissionMatrixEditor
        canEdit={canEditSettings}
        initialPermissions={permissions.map((row) => ({
          id: row.id,
          role: row.role as UserRole,
          resource: row.resource as PermissionResource,
          canView: row.canView,
          canEdit: row.canEdit,
        }))}
      />
    </div>
  );
}
