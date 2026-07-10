import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/constants";
import { StaffHub } from "@/components/staff/staff-hub";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  if (!STAFF_ROLES.includes(session.user.role)) redirect("/dashboard");

  const canManage = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SETTINGS,
    "edit",
  );

  const canViewCertAlerts = ADMIN_ROLES.includes(session.user.role);

  return (
    <StaffHub canManage={canManage} canViewCertAlerts={canViewCertAlerts} />
  );
}
