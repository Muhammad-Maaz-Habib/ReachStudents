import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";
import { UserRole } from "@/generated/prisma/browser";
import { PageHeader } from "@/components/design-system/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role === UserRole.PARENT) {
    redirect("/parent/dashboard");
  }

  if (session.user.role === UserRole.STUDENT) {
    redirect("/student/dashboard");
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Account"
        description="Manage your sign-in credentials for this organization."
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {session.user.email}
            </span>
            . After updating, you&apos;ll sign in again with the new password.
          </p>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm mode="voluntary" />
        </CardContent>
      </Card>
    </div>
  );
}
