"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsSaving(true);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not update password");
      return;
    }

    toast.success("Password updated — sign in with your new password");
    await signOut({ callbackUrl: "/login" });
  }

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
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Temporary password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                minLength={8}
                className="min-h-11"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                className="min-h-11"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                className="min-h-11"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="min-h-11 w-full" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
