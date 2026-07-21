import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MissingStudentAlert } from "@/lib/alerts/missing-students";

type MissingStudentsViewProps = {
  sessionName: string;
  alerts: Array<
    Omit<MissingStudentAlert, "startTime"> & { startTime: string }
  >;
};

export function MissingStudentsView({
  sessionName,
  alerts,
}: MissingStudentsViewProps) {
  const totalMissing = alerts.reduce(
    (sum, alert) => sum + alert.students.length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "size-11 shrink-0 rounded-xl",
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <PageHeader
            title="Missing from activity"
            description={`${sessionName} · ${totalMissing} student${totalMissing === 1 ? "" : "s"} overdue for check-in`}
            action={
              <StatusBadge
                status={totalMissing > 0 ? "danger" : "success"}
                label={totalMissing > 0 ? "Action needed" : "All clear"}
              />
            }
          />
        </div>
      </div>

      {totalMissing === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No missing students"
          description="Everyone expected at an in-progress activity has checked in (or no activities are past their alert threshold)."
          action={
            <Link
              href="/checkin/whos-here"
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              View who&apos;s here
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => (
            <Card
              key={alert.activityId}
              className="rounded-2xl border-destructive/30 bg-destructive/5"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <AlertTriangle
                    className="size-4 text-destructive"
                    aria-hidden
                  />
                  <span>{alert.activityName}</span>
                  {alert.location ? (
                    <span className="font-normal text-muted-foreground">
                      · {alert.location}
                    </span>
                  ) : null}
                </CardTitle>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden />
                  Started {alert.overdueMinutes} min ago · alert after{" "}
                  {alert.thresholdMinutes} min
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="grid gap-2" aria-label="Missing students">
                  {alert.students.map((student) => (
                    <li key={student.id}>
                      <Link
                        href={`/roster/${student.id}`}
                        className="flex min-h-12 items-center gap-3 rounded-xl border bg-background px-3 py-2 transition-colors hover:bg-muted/40"
                      >
                        <Avatar className="size-9 rounded-xl">
                          <AvatarFallback className="rounded-xl text-xs">
                            {student.firstName.charAt(0)}
                            {student.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {student.teamName ?? "Unassigned"}
                          </p>
                        </div>
                        <StatusBadge status="danger" label="Missing" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href={`/checkin/roll-call?activityId=${alert.activityId}`}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "min-h-11",
                    )}
                  >
                    Open roll call
                  </Link>
                  <Link
                    href="/schedule"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "min-h-11",
                    )}
                  >
                    View schedule
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
