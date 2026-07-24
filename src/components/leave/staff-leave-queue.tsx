"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LeaveRow = {
  id: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  status: string;
  reviewNote: string | null;
  canReview?: boolean;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    team: { name: string } | null;
    mentorGroup: { name: string } | null;
  };
  activities: { id: string; name: string }[];
};

function statusBadge(status: string) {
  if (status === "APPROVED") return <StatusBadge status="success" label="Approved" />;
  if (status === "DENIED") return <StatusBadge status="danger" label="Denied" />;
  if (status === "CANCELLED") return <StatusBadge status="neutral" label="Cancelled" />;
  return <StatusBadge status="warning" label="Pending" />;
}

export function StaffLeaveQueue({ canReviewDefault }: { canReviewDefault: boolean }) {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const params = filter === "PENDING" ? "?status=PENDING" : "";
    const response = await fetch(`/api/leave${params}`);
    if (!response.ok) {
      toast.error("Could not load leave queue");
      return;
    }
    const data = await response.json();
    setLeaves(data.leaves ?? []);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  async function review(leaveId: string, decision: "APPROVED" | "DENIED") {
    setBusyId(leaveId);
    const response = await fetch(`/api/leave/${leaveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        reviewNote: notes[leaveId]?.trim() || null,
      }),
    });
    setBusyId(null);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(
        typeof data.error === "string" ? data.error : "Could not update request",
      );
      return;
    }
    toast.success(decision === "APPROVED" ? "Leave approved" : "Leave denied");
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave requests"
        description="Approve or deny student leave. Mentors can review their mentees; admins see all."
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant={filter === "PENDING" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setFilter("PENDING")}
        >
          Pending
        </Button>
        <Button
          type="button"
          variant={filter === "ALL" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setFilter("ALL")}
        >
          All
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">
            {filter === "PENDING" ? "Awaiting review" : "All requests"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaves.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests in this view.</p>
          ) : (
            <ul className="space-y-4">
              {leaves.map((leave) => {
                const canReview =
                  (leave.canReview ?? canReviewDefault) &&
                  leave.status === "PENDING";
                return (
                  <li
                    key={leave.id}
                    className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {leave.student.firstName} {leave.student.lastName}
                        </p>
                        <p className="text-muted-foreground">
                          {leave.student.team?.name ?? "Unassigned"}
                          {leave.student.mentorGroup
                            ? ` · ${leave.student.mentorGroup.name}`
                            : ""}
                        </p>
                        <p className="mt-1">
                          {new Date(leave.startsAt).toLocaleString()} –{" "}
                          {new Date(leave.endsAt).toLocaleString()}
                        </p>
                      </div>
                      {statusBadge(leave.status)}
                    </div>
                    <p>{leave.reason}</p>
                    {leave.activities.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Activities:{" "}
                        {leave.activities.map((row) => row.name).join(", ")}
                      </p>
                    )}
                    {leave.reviewNote && leave.status !== "PENDING" && (
                      <p className="text-xs text-muted-foreground">
                        Note: {leave.reviewNote}
                      </p>
                    )}
                    {canReview && (
                      <div className="space-y-2 border-t pt-3">
                        <Label htmlFor={`note-${leave.id}`}>
                          Note to student/parents (optional)
                        </Label>
                        <Input
                          id={`note-${leave.id}`}
                          className="min-h-11"
                          value={notes[leave.id] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [leave.id]: event.target.value,
                            }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="min-h-11"
                            disabled={busyId === leave.id}
                            onClick={() => void review(leave.id, "APPROVED")}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={busyId === leave.id}
                            onClick={() => void review(leave.id, "DENIED")}
                          >
                            Deny
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
