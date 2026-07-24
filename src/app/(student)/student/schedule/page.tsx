import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLinkedStudentForUser } from "@/lib/students/account-service";
import { getStudentScheduleItems } from "@/lib/students/student-portal";
import { PageHeader } from "@/components/design-system/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default async function StudentSchedulePage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const student = await getLinkedStudentForUser(
    session.user.id,
    session.user.organizationId,
  );
  if (!student) {
    redirect("/student/dashboard");
  }

  const items = await getStudentScheduleItems(student.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My schedule"
        description="Activities assigned to you or your team."
      />
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nothing scheduled for you yet.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((activity) => (
                <li key={activity.id} className="space-y-1 p-4 text-sm">
                  <p className="font-medium">{activity.name}</p>
                  <p className="text-muted-foreground">
                    {activity.startTime.toLocaleString()} –{" "}
                    {activity.isOpenEnded
                      ? "Open-ended"
                      : activity.endTime.toLocaleTimeString()}
                  </p>
                  {activity.location && (
                    <p className="text-muted-foreground">{activity.location}</p>
                  )}
                  {activity.description && (
                    <p className="text-muted-foreground">{activity.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
