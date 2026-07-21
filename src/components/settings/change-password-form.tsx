"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChangePasswordFormProps = {
  /** Labels/copy for the forced first-login flow vs voluntary account change. */
  mode?: "forced" | "voluntary";
  currentPasswordLabel?: string;
  submitLabel?: string;
  className?: string;
};

export function ChangePasswordForm({
  mode = "voluntary",
  currentPasswordLabel =
    mode === "forced" ? "Temporary password" : "Current password",
  submitLabel = mode === "forced" ? "Save password" : "Update password",
  className,
}: ChangePasswordFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
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
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className={className ?? "space-y-4"}
    >
      <div className="space-y-2">
        <Label htmlFor="currentPassword">{currentPasswordLabel}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          minLength={8}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
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
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
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
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="min-h-11"
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={isSaving}>
        {isSaving ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
