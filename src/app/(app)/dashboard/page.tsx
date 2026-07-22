import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { getWhosHereData } from "@/lib/attendance/whos-here";
import { getActivityDistribution } from "@/lib/attendance/activity-distribution";
import { getLocationDistribution } from "@/lib/attendance/location-distribution";
import { getMissingStudentAlerts } from "@/lib/alerts/missing-students";
import { PageHeader } from "@/components/design-system/page-header";
import { WhosHereList } from "@/components/checkin/whos-here-list";
import { CampusMap } from "@/components/checkin/campus-map";
import { ActivityDistributionChart } from "@/components/dashboard/activity-distribution-chart";
import { DashboardStatCards } from "@/components/dashboard/dashboard-stat-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { MissingAlertNotifier } from "@/components/alerts/missing-alert-notifier";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 8;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/onboarding");
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const [whosHere, teamCount, studentCount, missingAlerts, distribution, locations] =
    await Promise.all([
      getWhosHereData(campSession.id),
      prisma.team.count({ where: { sessionId: campSession.id } }),
      prisma.student.count({ where: { sessionId: campSession.id } }),
      getMissingStudentAlerts(campSession.id),
      getActivityDistribution(campSession.id),
      getLocationDistribution(campSession.id),
    ]);

  const missingCount = missingAlerts.reduce(
    (sum, alert) => sum + alert.students.length,
    0,
  );

  return (
    <div className="space-y-8">
      <MissingAlertNotifier />
      <PageHeader
        title={`Good day${session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}`}
        description="Live attendance and safety alerts for your session."
        action={
          <Link href="/checkin" className={cn(buttonVariants(), "min-h-11")}>
            Open check-in
          </Link>
        }
      />

      {missingCount > 0 && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" aria-hidden />
              Missing student alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {missingAlerts.map((alert) => (
              <div
                key={alert.activityId}
                className="rounded-xl border border-destructive/20 bg-background p-3 text-sm"
              >
                <p className="font-medium">
                  {alert.activityName}
                  {alert.location ? ` · ${alert.location}` : ""}
                </p>
                <p className="text-muted-foreground">
                  Started {alert.overdueMinutes} min ago · threshold{" "}
                  {alert.thresholdMinutes} min
                </p>
                <p className="mt-2 text-destructive">
                  {alert.students
                    .map((s) => `${s.firstName} ${s.lastName}`)
                    .join(", ")}
                </p>
              </div>
            ))}
            <Link
              href="/checkin/missing"
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              View all missing
            </Link>
          </CardContent>
        </Card>
      )}

      <DashboardStatCards
        initial={{
          checkedInNow: whosHere.total,
          missingCount,
          studentCount,
          teamCount,
        }}
      />

      <ActivityDistributionChart
        initialSlices={distribution.slices}
        initialTotalStudents={distribution.totalStudents}
      />

      <CampusMap
        initialSlices={locations.slices}
        initialCheckedInCount={locations.checkedInCount}
        initialTotalStudents={locations.totalStudents}
      />

      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          <WhosHereList
            sessionName={campSession.name}
            total={whosHere.total}
            checkIns={whosHere.checkIns.map((checkIn) => ({
              ...checkIn,
              checkedInAt: checkIn.checkedInAt.toISOString(),
              notCheckedIn: checkIn.notCheckedIn ?? false,
            }))}
            teams={whosHere.teams}
            activities={whosHere.activities.map((activity) => ({
              ...activity,
              startTime: activity.startTime.toISOString(),
            }))}
            initialQuery=""
            previewLimit={PREVIEW_LIMIT}
            showViewAllLink
            compact
          />
        </CardContent>
      </Card>
    </div>
  );
}
