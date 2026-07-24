"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountInfo = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
} | null;

type StudentLoginPanelProps = {
  studentId: string;
  canManage: boolean;
  initialAccount: AccountInfo;
  suggestedEmail?: string | null;
};

export function StudentLoginPanel({
  studentId,
  canManage,
  initialAccount,
  suggestedEmail,
}: StudentLoginPanelProps) {
  const [account, setAccount] = useState(initialAccount);
  const [email, setEmail] = useState(
    initialAccount?.email ?? suggestedEmail ?? "",
  );
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!canManage) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Student login</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {account
            ? `Linked account: ${account.email}`
            : "No student login linked."}
        </CardContent>
      </Card>
    );
  }

  async function createOrLink() {
    setIsSaving(true);
    setTempPassword(null);
    const response = await fetch(`/api/students/${studentId}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        resetPassword: !account,
      }),
    });
    setIsSaving(false);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(
        typeof data.error === "string" ? data.error : "Could not create login",
      );
      return;
    }
    setAccount(data.student?.user ?? null);
    if (data.temporaryPassword) {
      setTempPassword(data.temporaryPassword);
      toast.success("Login ready — share the temporary password below");
    } else {
      toast.success("Login linked");
    }
  }

  async function resetPassword() {
    setIsSaving(true);
    setTempPassword(null);
    const response = await fetch(`/api/students/${studentId}/login`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    setIsSaving(false);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(
        typeof data.error === "string" ? data.error : "Could not reset password",
      );
      return;
    }
    setTempPassword(data.temporaryPassword ?? null);
    toast.success("Temporary password issued");
  }

  async function unlink() {
    if (!confirm("Unlink this login from the student for this session?")) return;
    setIsSaving(true);
    const response = await fetch(`/api/students/${studentId}/login`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlink" }),
    });
    setIsSaving(false);
    if (!response.ok) {
      toast.error("Could not unlink login");
      return;
    }
    setAccount(null);
    setTempPassword(null);
    toast.success("Login unlinked from this session");
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="size-5" aria-hidden />
          Student login
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Creates a portal account (schedule + staff messaging). No open
          signup — admin-provisioned only.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {account ? (
          <div className="space-y-3 text-sm">
            <p>
              Linked: <span className="font-medium">{account.email}</span>
              {!account.isActive ? " (inactive)" : ""}
              {account.mustChangePassword
                ? " · must change password on next login"
                : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={isSaving}
                onClick={() => void resetPassword()}
              >
                Reset temporary password
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-destructive"
                disabled={isSaving}
                onClick={() => void unlink()}
              >
                Unlink for this session
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="student-login-email">Login email</Label>
              <Input
                id="student-login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-11"
                placeholder="student@school.edu"
              />
            </div>
            <Button
              type="button"
              className="min-h-11"
              disabled={isSaving || !email.trim()}
              onClick={() => void createOrLink()}
            >
              {isSaving ? "Creating..." : "Create login"}
            </Button>
          </div>
        )}

        {tempPassword && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium">Temporary password</p>
            <p className="mt-2 font-mono text-base tracking-wide">{tempPassword}</p>
            <p className="mt-2 text-muted-foreground">
              Share securely. They must change it on first login. This is shown
              once.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-10"
              onClick={() => setTempPassword(null)}
            >
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
