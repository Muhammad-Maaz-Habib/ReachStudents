"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Plus } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  EventDropArg,
  DateSelectArg,
  EventClickArg,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
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
import {
  ACTIVITY_COLOR_PALETTE,
  nextActivityColor,
  normalizeActivityColor,
} from "@/lib/schedule/activity-colors";
import { cn } from "@/lib/utils";

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
    color?: string | null;
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

type EditState = {
  id: string;
  name: string;
  location: string;
  color: string;
  overdueAlertMinutes: number;
  startLocal: string;
  endLocal: string;
  seriesId: string | null;
};

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string) {
  return new Date(value);
}

function defaultSlotAround(date: Date) {
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  if (start.getHours() < 8) start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

function clampInitialDate(sessionStart: string, sessionEnd: string) {
  const start = new Date(`${sessionStart}T12:00:00`);
  const end = new Date(`${sessionEnd}T12:00:00`);
  const today = new Date();
  if (today >= start && today <= end) return today.toISOString().slice(0, 10);
  return sessionStart;
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="listbox" aria-label="Activity color">
      {ACTIVITY_COLOR_PALETTE.map((color) => {
        const selected = value.toUpperCase() === color.toUpperCase();
        return (
          <button
            key={color}
            type="button"
            role="option"
            aria-selected={selected}
            className={cn(
              "size-9 rounded-full border-2 transition-transform",
              selected
                ? "scale-110 border-foreground"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            aria-label={`Color ${color}`}
          />
        );
      })}
    </div>
  );
}

export function ScheduleBuilder({
  sessionName,
  sessionStart,
  sessionEnd,
  initialEvents,
  teams,
  canEdit,
}: ScheduleBuilderProps) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState(initialEvents);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createColor, setCreateColor] = useState<string>(() =>
    nextActivityColor(initialEvents.map((event) => event.backgroundColor)),
  );
  const [createStart, setCreateStart] = useState("");
  const [createEnd, setCreateEnd] = useState("");
  const [editState, setEditState] = useState<EditState | null>(null);

  const initialDate = useMemo(
    () => clampInitialDate(sessionStart, sessionEnd),
    [sessionStart, sessionEnd],
  );

  // FullCalendar validRange.end is exclusive — include the session's last day.
  const validRange = useMemo(() => {
    const end = new Date(`${sessionEnd}T12:00:00`);
    end.setDate(end.getDate() + 1);
    return {
      start: sessionStart,
      end: end.toISOString().slice(0, 10),
    };
  }, [sessionStart, sessionEnd]);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const openCreateDialog = useCallback(
    (start: Date, end: Date) => {
      if (!canEdit) return;
      setCreateStart(toDatetimeLocalValue(start));
      setCreateEnd(toDatetimeLocalValue(end));
      setCreateColor(nextActivityColor(events.map((event) => event.backgroundColor)));
      setCreateOpen(true);
    },
    [canEdit, events],
  );

  const handleSelect = useCallback(
    (info: DateSelectArg) => {
      openCreateDialog(info.start, info.end);
      info.view.calendar.unselect();
    },
    [openCreateDialog],
  );

  function openBlankCreate() {
    const anchor = new Date(`${initialDate}T12:00:00`);
    const { start, end } = defaultSlotAround(anchor);
    openCreateDialog(start, end);
  }

  async function createActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createStart || !createEnd) return;

    const start = fromDatetimeLocalValue(createStart);
    const end = fromDatetimeLocalValue(createEnd);
    if (!(end > start)) {
      toast.error("End time must be after start time");
      return;
    }

    setIsSaving(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      location: String(formData.get("location") ?? ""),
      overdueAlertMinutes: Number(formData.get("overdueAlertMinutes") ?? 15),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      color: createColor,
    };

    const response = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error ?? "Could not create activity");
      return;
    }

    toast.success("One-time activity added");
    setCreateOpen(false);
    router.refresh();
  }

  function openEditFromEvent(info: EventClickArg) {
    if (!canEdit) {
      const seriesNote = info.event.extendedProps.seriesId
        ? " (part of a recurring series)"
        : "";
      toast.info(
        `${info.event.title}${seriesNote}${info.event.extendedProps.location ? ` @ ${info.event.extendedProps.location}` : ""}`,
      );
      return;
    }

    if (!info.event.start || !info.event.end) return;

    setEditState({
      id: info.event.id,
      name: info.event.title,
      location: String(info.event.extendedProps.location ?? ""),
      color: normalizeActivityColor(
        info.event.extendedProps.color ?? info.event.backgroundColor,
      ),
      overdueAlertMinutes: Number(
        info.event.extendedProps.overdueAlertMinutes ?? 15,
      ),
      startLocal: toDatetimeLocalValue(info.event.start),
      endLocal: toDatetimeLocalValue(info.event.end),
      seriesId: (info.event.extendedProps.seriesId as string | null) ?? null,
    });
    setEditOpen(true);
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editState) return;

    const start = fromDatetimeLocalValue(editState.startLocal);
    const end = fromDatetimeLocalValue(editState.endLocal);
    if (!(end > start)) {
      toast.error("End time must be after start time");
      return;
    }

    setIsSaving(true);
    const response = await fetch(`/api/activities/${editState.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editState.name,
        location: editState.location,
        color: editState.color,
        overdueAlertMinutes: editState.overdueAlertMinutes,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      toast.error("Could not update activity");
      return;
    }

    toast.success(
      editState.seriesId
        ? "This instance updated — other series dates unchanged"
        : "Activity updated",
    );
    setEditOpen(false);
    router.refresh();
  }

  async function patchEventTimes(arg: EventDropArg | EventResizeDoneArg) {
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
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description={`${sessionName} · drag to create, drag to reschedule, or use the buttons`}
        action={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11" onClick={openBlankCreate}>
                <Plus className="size-4" aria-hidden />
                Add activity
              </Button>
              <RecurringSeriesTrigger
                sessionStart={sessionStart}
                sessionEnd={sessionEnd}
                teams={teams}
                existingColors={events.map((event) => event.backgroundColor)}
              />
            </div>
          ) : undefined
        }
      />

      {!canEdit && (
        <p className="rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          View only — you need schedule edit permission to create or move activities.
        </p>
      )}

      <div className="flex gap-3 rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium text-foreground">How to edit</p>
          <p>
            <strong>Drag on empty calendar space</strong> to create a one-time block,
            or use <strong>Add activity</strong>.{" "}
            <strong>Drag an existing block</strong> to reschedule;{" "}
            <strong>tap it</strong> to edit name, color, and times. Recurring
            moves only affect that one instance.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="schedule-calendar p-2 sm:p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            initialDate={initialDate}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            validRange={validRange}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            height="auto"
            selectable={canEdit}
            selectMirror
            editable={canEdit}
            eventStartEditable={canEdit}
            eventDurationEditable={canEdit}
            events={events}
            select={handleSelect}
            eventDrop={(arg) => void patchEventTimes(arg)}
            eventResize={(arg) => void patchEventTimes(arg)}
            eventClick={openEditFromEvent}
          />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>One-time activity</DialogTitle>
            <DialogDescription>
              Creates a single calendar block. Use recurring series for weekly
              patterns.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void createActivity(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" className="min-h-11" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-start">Starts</Label>
                <Input
                  id="create-start"
                  type="datetime-local"
                  className="min-h-11"
                  value={createStart}
                  onChange={(event) => setCreateStart(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-end">Ends</Label>
                <Input
                  id="create-end"
                  type="datetime-local"
                  className="min-h-11"
                  value={createEnd}
                  onChange={(event) => setCreateEnd(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={createColor} onChange={setCreateColor} />
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
                {isSaving ? "Saving..." : "Create activity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit activity</DialogTitle>
            <DialogDescription>
              {editState?.seriesId
                ? "This block is part of a recurring series — changes apply to this instance only."
                : "Update name, time, location, or color."}
            </DialogDescription>
          </DialogHeader>
          {editState && (
            <form onSubmit={(event) => void saveEdit(event)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  className="min-h-11"
                  value={editState.name}
                  onChange={(event) =>
                    setEditState({ ...editState, name: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  className="min-h-11"
                  value={editState.location}
                  onChange={(event) =>
                    setEditState({ ...editState, location: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-start">Starts</Label>
                  <Input
                    id="edit-start"
                    type="datetime-local"
                    className="min-h-11"
                    value={editState.startLocal}
                    onChange={(event) =>
                      setEditState({
                        ...editState,
                        startLocal: event.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end">Ends</Label>
                  <Input
                    id="edit-end"
                    type="datetime-local"
                    className="min-h-11"
                    value={editState.endLocal}
                    onChange={(event) =>
                      setEditState({
                        ...editState,
                        endLocal: event.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <ColorPicker
                  value={editState.color}
                  onChange={(color) => setEditState({ ...editState, color })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-overdue">Missing check-in alert (min)</Label>
                <Input
                  id="edit-overdue"
                  type="number"
                  min={0}
                  max={120}
                  className="min-h-11"
                  value={editState.overdueAlertMinutes}
                  onChange={(event) =>
                    setEditState({
                      ...editState,
                      overdueAlertMinutes: Number(event.target.value) || 0,
                    })
                  }
                />
              </div>
              <DialogFooter>
                <Button type="submit" className="min-h-11" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
