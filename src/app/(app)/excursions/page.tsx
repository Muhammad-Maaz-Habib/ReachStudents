import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { PageHeader } from "@/components/design-system/page-header";
import {
  ExcursionsPanel,
  type ExcursionSummary,
} from "@/components/excursions/excursions-panel";

export default async function ExcursionsPage() {
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

  const rawExcursions = activeSession
    ? await prisma.excursion.findMany({
        where: { sessionId: activeSession.id },
        orderBy: [{ startTime: "asc" }, { name: "asc" }],
      })
    : [];

  const initialExcursions: ExcursionSummary[] = rawExcursions.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    name: row.name,
    destination: row.destination,
    notes: row.notes,
    capacity: row.capacity,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
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
        title="Excursions"
        description="Off-site trips — separate from on-campus schedule. Link emergency GPS pings to a trip."
      />
      <ExcursionsPanel
        canEdit={canEdit}
        sessions={sessionSummaries}
        initialSessionId={activeSession?.id ?? null}
        initialExcursions={initialExcursions}
      />
    </div>
  );
}
