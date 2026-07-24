import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { ADMIN_ROLES } from "@/lib/constants";
import { StaffLeaveQueue } from "@/components/leave/staff-leave-queue";

export default async function LeavePage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  const canView = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.STUDENTS,
    "view",
  );
  if (!canView) redirect("/dashboard");

  return (
    <StaffLeaveQueue
      canReviewDefault={ADMIN_ROLES.includes(session.user.role)}
    />
  );
}
