import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource, UserRole } from "@/generated/prisma/browser";
import { PageHeader } from "@/components/design-system/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionMatrixEditor } from "@/components/settings/permission-matrix-editor";
import { DataRetentionPanel } from "@/components/settings/data-retention-panel";

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
        orderBy: { startDate: "asc" },
      }),
      prisma.permissionMatrix.findMany({
        where: { organizationId: session.user.organizationId },
        orderBy: [{ role: "asc" }, { resource: "asc" }],
      }),
    ]);

  if (!canViewSettings) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Organization profile, sessions, and permission matrix."
      />

      <div className="grid gap-6 lg:grid-cols-2">
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

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((campSession) => (
              <div
                key={campSession.id}
                className="rounded-xl border bg-muted/30 p-3 text-sm"
              >
                <p className="font-medium">{campSession.name}</p>
                <p className="text-muted-foreground">
                  {campSession.startDate.toLocaleDateString()} –{" "}
                  {campSession.endDate.toLocaleDateString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {campSession._count.teams} teams · {campSession._count.students}{" "}
                  students
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
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
