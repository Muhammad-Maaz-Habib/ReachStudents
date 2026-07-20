"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Repeat } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_COLOR_PALETTE,
  nextActivityColor,
  normalizeActivityColor,
} from "@/lib/schedule/activity-colors";

const DAY_LABELS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

type TeamOption = { id: string; name: string };

type RecurringSeriesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionStart: string;
  sessionEnd: string;
  teams: TeamOption[];
  existingColors?: (string | null | undefined)[];
};

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function RecurringSeriesDialog({
  open,
  onOpenChange,
  sessionStart,
  sessionEnd,
  teams,
  existingColors = [],
}: RecurringSeriesDialogProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [teamId, setTeamId] = useState<string>("");
  const [color, setColor] = useState(() =>
    nextActivityColor(existingColors),
  );

  const existingColorsKey = existingColors
    .filter(Boolean)
    .map((value) => String(value).toUpperCase())
    .join(",");

  useEffect(() => {
    if (open) {
      setColor(nextActivityColor(existingColorsKey ? existingColorsKey.split(",") : []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-pick when dialog opens or palette usage changes
  }, [open, existingColorsKey]);

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedDays.length === 0) {
      toast.error("Pick at least one day of the week");
      return;
    }

    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const payload = {
      name: String(formData.get("name") ?? ""),
      location: String(formData.get("location") ?? ""),
      color: normalizeActivityColor(color),
      teamId: teamId || undefined,
      recurrenceDays: selectedDays,
      startTimeMinutes: timeToMinutes(String(formData.get("startTime") ?? "14:00")),
      durationMinutes: Number(formData.get("durationMinutes") ?? 60),
      rangeStart: String(formData.get("rangeStart") ?? sessionStart),
      rangeEnd: String(formData.get("rangeEnd") ?? sessionEnd),
      overdueAlertMinutes: Number(formData.get("overdueAlertMinutes") ?? 15),
    };

    const response = await fetch("/api/activities/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      toast.error(data.error ?? "Could not create recurring series");
      return;
    }

    toast.success(
      `Created ${data.activities?.length ?? 0} activity instances`,
    );
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recurring activity series</DialogTitle>
          <DialogDescription>
            e.g. Afternoon Swim every Mon/Wed/Fri at 2:00 PM. Waypoint generates
            one calendar block per occurrence.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="series-name">Name</Label>
            <Input
              id="series-name"
              name="name"
              placeholder="Afternoon Swim"
              required
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-location">Location</Label>
            <Input
              id="series-location"
              name="location"
              placeholder="Pool"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Repeats on</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((day) => {
                const active = selectedDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    className={cn(
                      "min-h-11 min-w-11 rounded-xl border px-3 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted",
                    )}
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start time</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue="14:00"
                required
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMinutes">Duration (minutes)</Label>
              <Input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={15}
                max={480}
                defaultValue={60}
                required
                className="min-h-11"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rangeStart">Series starts</Label>
              <Input
                id="rangeStart"
                name="rangeStart"
                type="date"
                defaultValue={sessionStart}
                required
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rangeEnd">Series ends</Label>
              <Input
                id="rangeEnd"
                name="rangeEnd"
                type="date"
                defaultValue={sessionEnd}
                required
                className="min-h-11"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2" role="listbox" aria-label="Series color">
              {ACTIVITY_COLOR_PALETTE.map((swatch) => {
                const selected = color.toUpperCase() === swatch.toUpperCase();
                return (
                  <button
                    key={swatch}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "size-9 rounded-full border-2 transition-transform",
                      selected
                        ? "scale-110 border-foreground"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: swatch }}
                    onClick={() => setColor(swatch)}
                    aria-label={`Color ${swatch}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-team">Team (optional)</Label>
            <Select
              value={teamId || undefined}
              onValueChange={(value) => setTeamId(value ?? "")}
            >
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="All students / session-wide" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-overdue">Missing check-in alert (min after start)</Label>
            <Input
              id="series-overdue"
              name="overdueAlertMinutes"
              type="number"
              min={0}
              max={120}
              defaultValue={15}
              className="min-h-11"
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="min-h-11 w-full" disabled={isSaving}>
              <Repeat className="size-4" aria-hidden />
              {isSaving ? "Generating..." : "Create recurring series"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecurringSeriesTrigger({
  sessionStart,
  sessionEnd,
  teams,
  existingColors = [],
  disabled,
}: {
  sessionStart: string;
  sessionEnd: string;
  teams: TeamOption[];
  existingColors?: (string | null | undefined)[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Repeat className="size-4" aria-hidden />
        Add recurring series
      </Button>
      <RecurringSeriesDialog
        open={open}
        onOpenChange={setOpen}
        sessionStart={sessionStart}
        sessionEnd={sessionEnd}
        teams={teams}
        existingColors={existingColors}
      />
    </>
  );
}
