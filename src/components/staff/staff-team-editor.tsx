"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type TeamOption = { id: string; name: string; color: string | null };

type StaffTeamEditorProps = {
  staffId: string;
  staffName: string;
  initialTeamIds: string[];
  availableTeams: TeamOption[];
  onSaved: (teamIds: string[], teamNames: string[]) => void;
};

export function StaffTeamEditor({
  staffId,
  staffName,
  initialTeamIds,
  availableTeams,
  onSaved,
}: StaffTeamEditorProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialTeamIds);
  const [isSaving, setIsSaving] = useState(false);

  function openEditor() {
    setSelected(initialTeamIds);
    setOpen(true);
  }

  function toggleTeam(teamId: string) {
    setSelected((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    );
  }

  async function save() {
    setIsSaving(true);
    const response = await fetch(`/api/staff/${staffId}/teams`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamIds: selected }),
    });
    setIsSaving(false);

    if (!response.ok) {
      toast.error("Could not update team assignments");
      return;
    }

    const data = await response.json();
    const teams = (data.teams ?? []) as TeamOption[];
    onSaved(
      teams.map((team) => team.id),
      teams.map((team) => team.name),
    );
    toast.success("Team assignments updated");
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9"
        onClick={openEditor}
      >
        <Pencil className="size-3.5" aria-hidden />
        Edit teams
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit team assignments</DialogTitle>
            <DialogDescription>
              Choose which teams {staffName} can access. Changes apply
              immediately — no re-login needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {availableTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No teams in this session yet.
              </p>
            ) : (
              availableTeams.map((team) => {
                const checked = selected.includes(team.id);
                return (
                  <label
                    key={team.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={checked}
                      onChange={() => toggleTeam(team.id)}
                    />
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: team.color ?? "var(--muted-foreground)",
                      }}
                      aria-hidden
                    />
                    <span className="font-medium">{team.name}</span>
                  </label>
                );
              })
            )}
            <Label className="text-xs text-muted-foreground">
              Unassigned staff cannot check in team-scoped students.
            </Label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={isSaving}
              onClick={() => void save()}
            >
              {isSaving ? "Saving..." : "Save teams"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
