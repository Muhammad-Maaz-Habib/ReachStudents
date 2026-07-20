import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { getWhosHereData } from "@/lib/attendance/whos-here";
import { getRollCallData } from "@/lib/attendance/roll-call";
import { WhosHereList } from "@/components/checkin/whos-here-list";
import { RollCallView } from "@/components/emergency/roll-call-view";
import { PageLoadingState } from "@/components/design-system/loading-state";
import { STAFF_ROLES } from "@/lib/constants";

type WhosHerePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function WhosHereContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  if (!STAFF_ROLES.includes(session.user.role)) redirect("/dashboard");

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const mode = typeof searchParams.mode === "string" ? searchParams.mode : undefined;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const teamId =
    typeof searchParams.teamId === "string" ? searchParams.teamId : undefined;
  let activityId =
    typeof searchParams.activityId === "string"
      ? searchParams.activityId
      : undefined;

  if (mode === "rollcall") {
    const rollCall = await getRollCallData(campSession.id, { teamId });

    return (
      <RollCallView
        sessionName={campSession.name}
        initialTeamId={teamId}
        teams={rollCall.teams}
        initialData={{
          totalExpected: rollCall.totalExpected,
          presentCount: rollCall.presentCount,
          missingCount: rollCall.missingCount,
          present: rollCall.present.map((row) => ({
            student: row.student,
            checkedInAt: row.checkedInAt.toISOString(),
            activity: row.activity,
          })),
          missing: rollCall.missing,
        }}
      />
    );
  }

  const data = await getWhosHereData(campSession.id, {
    q,
    teamId,
    activityId,
  });

  return (
    <WhosHereList
      sessionName={campSession.name}
      total={data.total}
      checkIns={data.checkIns.map((checkIn) => ({
        ...checkIn,
        checkedInAt: checkIn.checkedInAt.toISOString(),
        notCheckedIn: checkIn.notCheckedIn ?? false,
      }))}
      teams={data.teams}
      activities={data.activities.map((activity) => ({
        ...activity,
        startTime: activity.startTime.toISOString(),
      }))}
      initialQuery={q ?? ""}
      initialTeamId={teamId}
      initialActivityId={activityId}
    />
  );
}

export default async function WhosHerePage({ searchParams }: WhosHerePageProps) {
  const params = await searchParams;
  return (
    <Suspense fallback={<PageLoadingState />}>
      <WhosHereContent searchParams={params} />
    </Suspense>
  );
}
