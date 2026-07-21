"use client";

import { useSession } from "next-auth/react";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChangePasswordPage() {
  const { data: session } = useSession();

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <p className="text-sm text-muted-foreground">
            {session?.user?.email
              ? `Welcome, ${session.user.email}. `
              : ""}
            Imported staff accounts must replace their temporary password before
            continuing.
          </p>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm mode="forced" className="space-y-4" />
        </CardContent>
      </Card>
    </div>
  );
}
