"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IMPORTABLE_STAFF_ROLES } from "@/lib/csv/staff-import";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/generated/prisma/browser";

type TeamOption = { id: string; name: string };

type StaffFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamOption[];
  onCreated?: () => void;
};

export function StaffFormDialog({
  open,
  onOpenChange,
  teams,
  onCreated,
}: StaffFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<string>("STAFF");
  const [teamId, setTeamId] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setTemporaryPassword(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      role,
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      teamId: teamId || undefined,
      emergencyContact1Name: String(formData.get("emergencyContact1Name") ?? ""),
      emergencyContact1Phone: String(
        formData.get("emergencyContact1Phone") ?? "",
      ),
      emergencyContact2Name: String(formData.get("emergencyContact2Name") ?? ""),
      emergencyContact2Phone: String(
        formData.get("emergencyContact2Phone") ?? "",
      ),
      foodAllergy: String(formData.get("foodAllergy") ?? ""),
      dietaryRestriction: String(formData.get("dietaryRestriction") ?? ""),
      dietaryOther: String(formData.get("dietaryOther") ?? ""),
    };

    const response = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setIsLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Could not add staff member");
      return;
    }

    if (data.temporaryPassword) {
      setTemporaryPassword(data.temporaryPassword);
      toast.success("Staff added — share the temporary password below");
    } else {
      toast.success(
        data.action === "updated" ? "Staff profile updated" : "Staff added",
      );
      onOpenChange(false);
    }
    onCreated?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTemporaryPassword(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add staff</DialogTitle>
          <DialogDescription>
            Creates a login account with a temporary password. Same fields as
            the staff CSV import.
          </DialogDescription>
        </DialogHeader>

        {temporaryPassword ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Temporary password</p>
              <p className="mt-2 font-mono text-base">{temporaryPassword}</p>
              <p className="mt-2 text-muted-foreground">
                Share this securely. They must change it on first login.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                className="min-h-11"
                onClick={() => {
                  setTemporaryPassword(null);
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff-firstName">First name</Label>
                <Input
                  id="staff-firstName"
                  name="firstName"
                  className="min-h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-lastName">Last name</Label>
                <Input
                  id="staff-lastName"
                  name="lastName"
                  className="min-h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  name="email"
                  type="email"
                  className="min-h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input id="staff-phone" name="phone" className="min-h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-role">Role</Label>
                <select
                  id="staff-role"
                  className="min-h-11 w-full rounded-xl border bg-background px-3"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  required
                >
                  {IMPORTABLE_STAFF_ROLES.map((value) => (
                    <option key={value} value={value}>
                      {ROLE_LABELS[value as UserRole]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-team">Team (optional)</Label>
                <select
                  id="staff-team"
                  className="min-h-11 w-full rounded-xl border bg-background px-3"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  <option value="">No team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm font-medium">Emergency contacts</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ec1-name">Contact 1 name</Label>
                  <Input
                    id="ec1-name"
                    name="emergencyContact1Name"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ec1-phone">Contact 1 phone</Label>
                  <Input
                    id="ec1-phone"
                    name="emergencyContact1Phone"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ec2-name">Contact 2 name</Label>
                  <Input
                    id="ec2-name"
                    name="emergencyContact2Name"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ec2-phone">Contact 2 phone</Label>
                  <Input
                    id="ec2-phone"
                    name="emergencyContact2Phone"
                    className="min-h-11"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm font-medium">Dietary / allergy</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="foodAllergy">Food allergy</Label>
                  <Input
                    id="foodAllergy"
                    name="foodAllergy"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dietaryRestriction">Dietary restriction</Label>
                  <Input
                    id="dietaryRestriction"
                    name="dietaryRestriction"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="dietaryOther">Other notes</Label>
                  <Input
                    id="dietaryOther"
                    name="dietaryOther"
                    className="min-h-11"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="submit"
                className="min-h-11 w-full sm:w-auto"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Add staff"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
