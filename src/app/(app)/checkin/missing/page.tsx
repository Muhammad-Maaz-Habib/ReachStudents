import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { getMissingStudentAlerts } from "@/lib/alerts/missing-students";
import { STAFF_ROLES } from "@/lib/constants";
import { MissingStudentsView } from "@/components/alerts/missing-students-view";

export default async function MissingStudentsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/onboarding");
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    redirect("/dashboard");
  }

  const campSession = await requireOrganizationSession(
    session.user.organizationId,
  );
  const alerts = await getMissingStudentAlerts(campSession.id);

  return (
    <MissingStudentsView
      sessionName={campSession.name}
      alerts={alerts.map((alert) => ({
        ...alert,
        startTime: alert.startTime.toISOString(),
      }))}
    />
  );
}
