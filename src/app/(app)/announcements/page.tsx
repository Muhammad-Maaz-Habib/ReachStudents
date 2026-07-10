import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { AnnouncementsHub } from "@/components/messaging/announcements-hub";

export default async function AnnouncementsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  const [canView, canEdit] = await Promise.all([
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.MESSAGING,
      "view",
    ),
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.MESSAGING,
      "edit",
    ),
  ]);

  if (!canView) redirect("/dashboard");

  return <AnnouncementsHub canEdit={canEdit} />;
}
