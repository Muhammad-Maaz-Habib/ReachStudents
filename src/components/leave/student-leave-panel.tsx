"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActivityOption = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

type LeaveRow = {
  id: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  status: string;
  reviewNote: string | null;
  activities: { id: string; name: string }[];
};

function statusBadge(status: string) {
  if (status === "APPROVED") return <StatusBadge status="success" label="Approved" />;
  if (status === "DENIED") return <StatusBadge status="danger" label="Denied" />;
  if (status === "CANCELLED") return <StatusBadge status="neutral" label="Cancelled" />;
  return <StatusBadge status="warning" label="Pending" />;
}

function toDatetimeLocalValue(iso?: string) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function StudentLeavePanel() {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState(toDatetimeLocalValue());
  const [endsAt, setEndsAt] = useState("");
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/leave");
    if (!response.ok) {
      toast.error("Could not load leave requests");
      return;
    }
    const data = await response.json();
    setLeaves(data.leaves ?? []);
    setActivities(data.activities ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim() || !startsAt || !endsAt) return;
    setIsSaving(true);
    const response = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: reason.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        activityIds,
      }),
    });
    setIsSaving(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(
        typeof data.error === "string" ? data.error : "Could not submit request",
      );
      return;
    }
    toast.success("Leave request submitted");
    setReason("");
    setActivityIds([]);
    await load();
  }

  async function cancel(leaveId: string) {
    const response = await fetch(`/api/leave/${leaveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (!response.ok) {
      toast.error("Could not cancel request");
      return;
    }
    toast.success("Request cancelled");
    await load();
  }

  function toggleActivity(id: string) {
    setActivityIds((current) =>
      current.includes(id)
        ? current.filter((row) => row !== id)
        : [...current, id],
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave requests"
        description="Request time away. Admins and your mentor review each request."
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">New request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leave-start">Start</Label>
                <Input
                  id="leave-start"
                  type="datetime-local"
                  required
                  className="min-h-11"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave-end">End</Label>
                <Input
                  id="leave-end"
                  type="datetime-local"
                  required
                  className="min-h-11"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-reason">Reason</Label>
              <textarea
                id="leave-reason"
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
            </div>
            {activities.length > 0 && (
              <div className="space-y-2">
                <Label>Activities affected (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Leave blank to cover all activities during this window.
                </p>
                <ul className="max-h-40 space-y-2 overflow-y-auto rounded-xl border p-3">
                  {activities.map((activity) => (
                    <li key={activity.id}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 size-4"
                          checked={activityIds.includes(activity.id)}
                          onChange={() => toggleActivity(activity.id)}
                        />
                        <span>
                          {activity.name}
                          <span className="block text-xs text-muted-foreground">
                            {new Date(activity.startTime).toLocaleString()}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button type="submit" className="min-h-11" disabled={isSaving}>
              {isSaving ? "Submitting..." : "Submit leave request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Your requests</CardTitle>
        </CardHeader>
        <CardContent>
          {leaves.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave requests yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {leaves.map((leave) => (
                <li key={leave.id} className="space-y-2 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {new Date(leave.startsAt).toLocaleString()} –{" "}
                      {new Date(leave.endsAt).toLocaleString()}
                    </p>
                    {statusBadge(leave.status)}
                  </div>
                  <p className="text-muted-foreground">{leave.reason}</p>
                  {leave.activities.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Activities:{" "}
                      {leave.activities.map((row) => row.name).join(", ")}
                    </p>
                  )}
                  {leave.reviewNote && (
                    <p className="text-xs text-muted-foreground">
                      Review note: {leave.reviewNote}
                    </p>
                  )}
                  {leave.status === "PENDING" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10"
                      onClick={() => void cancel(leave.id)}
                    >
                      Cancel request
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
