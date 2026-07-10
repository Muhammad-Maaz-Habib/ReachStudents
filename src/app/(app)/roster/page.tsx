import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRosterData } from "@/lib/roster";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { RosterView } from "@/components/roster/roster-view";
import { PageLoadingState } from "@/components/design-system/loading-state";
import { rosterQuerySchema } from "@/lib/validations/student";

type RosterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function RosterContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/onboarding");
  }

  const query = rosterQuerySchema.parse({
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
    teamId:
      typeof searchParams.teamId === "string" ? searchParams.teamId : undefined,
    grade:
      typeof searchParams.grade === "string" ? searchParams.grade : undefined,
    hasAllergy:
      typeof searchParams.hasAllergy === "string"
        ? searchParams.hasAllergy
        : undefined,
    staffId:
      typeof searchParams.staffId === "string" ? searchParams.staffId : undefined,
  });

  const [roster, canEdit] = await Promise.all([
    getRosterData(session.user.organizationId, query),
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.STUDENTS,
      "edit",
    ),
  ]);

  return (
    <RosterView
      sessionName={roster.session.name}
      teams={roster.teams}
      staffUsers={roster.staffUsers}
      grades={roster.grades}
      students={roster.students}
      canEdit={canEdit}
      initialQuery={query.q ?? ""}
      initialTeamId={query.teamId}
      initialGrade={query.grade}
      initialHasAllergy={query.hasAllergy}
      initialStaffId={query.staffId}
    />
  );
}

export default async function RosterPage({ searchParams }: RosterPageProps) {
  const params = await searchParams;

  return (
    <Suspense fallback={<PageLoadingState />}>
      <RosterContent searchParams={params} />
    </Suspense>
  );
}
