import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, ClipboardList, MessageSquare } from "lucide-react";
import { auth } from "@/lib/auth";
import { getLinkedStudentForUser } from "@/lib/students/account-service";
import { getStudentScheduleItems } from "@/lib/students/student-portal";
import { PageHeader } from "@/components/design-system/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function StudentDashboardPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const student = await getLinkedStudentForUser(
    session.user.id,
    session.user.organizationId,
  );

  if (!student) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Student portal"
          description="Your account is not linked to a roster entry for the active session."
        />
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Ask a Session Admin to create or re-link your login from the roster.
          </CardContent>
        </Card>
      </div>
    );
  }

  const schedule = await getStudentScheduleItems(student.id);
  const upcoming = schedule
    .filter((row) => row.endTime.getTime() >= Date.now() - 60 * 60 * 1000)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi, ${student.firstName}`}
        description={
          student.team
            ? `${student.team.name}${student.mentorGroup ? ` · ${student.mentorGroup.name}` : ""}`
            : "Your schedule and messages with program staff."
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/student/schedule"
          className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
        >
          <Calendar className="size-4" aria-hidden />
          Full schedule
        </Link>
        <Link
          href="/student/leave"
          className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
        >
          <ClipboardList className="size-4" aria-hidden />
          Leave requests
        </Link>
        <Link
          href="/student/messages"
          className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
        >
          <MessageSquare className="size-4" aria-hidden />
          Messages
        </Link>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Coming up</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming activities on your schedule yet.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {upcoming.map((activity) => (
                <li key={activity.id} className="p-3 text-sm">
                  <p className="font-medium">{activity.name}</p>
                  <p className="text-muted-foreground">
                    {activity.startTime.toLocaleString()}
                    {activity.location ? ` · ${activity.location}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
