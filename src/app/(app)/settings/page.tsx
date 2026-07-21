import { redirect } from "next/navigation";
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
        description="Organization profile, sessions, teams, and permission matrix."
      />

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
