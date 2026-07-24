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
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { OrganizationBrandingPanel } from "@/components/settings/organization-branding-panel";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/onboarding");
  }

  const canEditBranding = session.user.role === UserRole.SUPER_ADMIN;

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
        description="Organization branding, sessions, teams, and permission matrix."
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

      <OrganizationBrandingPanel
        canEdit={canEditBranding}
        initialName={organization?.name ?? ""}
        initialSlug={organization?.slug ?? ""}
        initialLogoUrl={organization?.logoUrl ?? null}
        primaryColor={organization?.primaryColor ?? "#E07A3A"}
        secondaryColor={organization?.secondaryColor ?? "#2D6A4F"}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SessionsPanel canEdit={canEditSettings} initialSessions={sessionSummaries} />
        <TeamsPanel
          canEdit={canEditSettings}
          sessions={sessionSummaries}
          initialSessionId={activeSession?.id ?? null}
          initialTeams={initialTeams}
        />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Mentor groups</CardTitle>
          <p className="text-sm text-muted-foreground">
            Day-to-day mentor cohorts are managed on their own page.
          </p>
        </CardHeader>
        <CardContent>
          <Link
            href="/mentor-groups"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open Mentor Groups →
          </Link>
        </CardContent>
      </Card>

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
