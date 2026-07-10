import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { FormsHub } from "@/components/forms/forms-hub";

export default async function FormsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");

  const [canView, canEdit] = await Promise.all([
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.FORMS,
      "view",
    ),
    hasPermission(
      session.user.organizationId,
      session.user.role,
      PermissionResource.FORMS,
      "edit",
    ),
  ]);
  if (!canView) redirect("/dashboard");

  return <FormsHub canEdit={canEdit} />;
}
