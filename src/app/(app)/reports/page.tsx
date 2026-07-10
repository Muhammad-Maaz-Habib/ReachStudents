import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { ReportsHub } from "@/components/reports/reports-hub";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  const canView = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.REPORTS,
    "view",
  );
  if (!canView) redirect("/dashboard");

  return <ReportsHub />;
}
