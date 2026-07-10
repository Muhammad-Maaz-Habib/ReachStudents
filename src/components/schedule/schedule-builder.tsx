"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventDropArg, DateSelectArg } from "@fullcalendar/core";
import { PageHeader } from "@/components/design-system/page-header";
import { RecurringSeriesTrigger } from "@/components/schedule/recurring-series-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CalendarActivity = {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  extendedProps: {
    location?: string | null;
    teamName?: string | null;
    overdueAlertMinutes: number;
    seriesId?: string | null;
  };
};

type TeamOption = { id: string; name: string };

type ScheduleBuilderProps = {
  sessionName: string;
  sessionStart: string;
  sessionEnd: string;
  initialEvents: CalendarActivity[];
  teams: TeamOption[];
  canEdit: boolean;
};

export function ScheduleBuilder({
  sessionName,
  sessionStart,
  sessionEnd,
  initialEvents,
  teams,
  canEdit,
}: ScheduleBuilderProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selection, setSelection] = useState<DateSelectArg | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelect = useCallback(
    (info: DateSelectArg) => {
      if (!canEdit) return;
      setSelection(info);
      setDialogOpen(true);
    },
    [canEdit],
  );

  async function createActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      location: String(formData.get("location") ?? ""),
      overdueAlertMinutes: Number(formData.get("overdueAlertMinutes") ?? 15),
      startTime: selection.start.toISOString(),
      endTime: selection.end.toISOString(),
      color: "#E07A3A",
    };

    const response = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error ?? "Could not create activity");
      return;
    }

    toast.success("One-time activity added");
    setDialogOpen(false);
    router.refresh();
  }

  async function handleEventDrop(arg: EventDropArg) {
    if (!canEdit) {
      arg.revert();
      return;
    }

    const response = await fetch(`/api/activities/${arg.event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: arg.event.start?.toISOString(),
        endTime: arg.event.end?.toISOString(),
      }),
    });

    if (!response.ok) {
      arg.revert();
      toast.error("Could not reschedule activity");
      return;
    }

    const isRecurring = !!arg.event.extendedProps.seriesId;
    toast.success(
      isRecurring
        ? "This instance moved — other dates in the series are unchanged"
        : "Activity rescheduled",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description={`${sessionName} · drag to create one-time blocks, or add a recurring series`}
        action={
          canEdit ? (
            <RecurringSeriesTrigger
              sessionStart={sessionStart}
              sessionEnd={sessionEnd}
              teams={teams}
            />
          ) : undefined
        }
      />

      <div className="flex gap-3 rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Editing recurring activities</p>
          <p>
            Dragging an event only changes <strong>that one instance</strong>. Other
            dates in the same series stay put. To change all future swim blocks, edit
            the series (coming soon) or create a new series.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-2 sm:p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            validRange={{ start: sessionStart, end: sessionEnd }}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            height="auto"
            selectable={canEdit}
            selectMirror
            editable={canEdit}
            events={initialEvents}
            select={handleSelect}
            eventDrop={handleEventDrop}
            eventClick={(info) => {
              const seriesNote = info.event.extendedProps.seriesId
                ? " (part of a recurring series)"
                : "";
              toast.info(
                `${info.event.title}${seriesNote}${info.event.extendedProps.location ? ` @ ${info.event.extendedProps.location}` : ""}`,
              );
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>One-time activity</DialogTitle>
            <DialogDescription>
              {selection
                ? `${selection.start.toLocaleString()} – ${selection.end.toLocaleString()}`
                : "Drag on the calendar to pick a time slot"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createActivity} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overdueAlertMinutes">
                Missing check-in alert (minutes after start)
              </Label>
              <Input
                id="overdueAlertMinutes"
                name="overdueAlertMinutes"
                type="number"
                min={0}
                max={120}
                defaultValue={15}
                className="min-h-11"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Saving..." : "Create one-time activity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
