"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/design-system/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StudentOption = { id: string; name: string };

type Incident = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  location: string | null;
  createdAt: string;
  reportedByName: string | null;
  students: string[];
  hasParentThread: boolean;
};

type IncidentsHubProps = {
  canEdit: boolean;
  students: StudentOption[];
};

export function IncidentsHub({ canEdit, students }: IncidentsHubProps) {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<string[]>(
    students[0] ? [students[0].id] : [],
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [notifyParent, setNotifyParent] = useState(false);
  const [severityHintDismissed, setSeverityHintDismissed] = useState(false);
  const [parentMessage, setParentMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showHighSeverityConfirm, setShowHighSeverityConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/incidents");
      if (!response.ok) return;
      const data = await response.json();
      setIncidents(data.incidents ?? []);
      setIsLoading(false);
    }
    void load();
  }, []);

  function onSeverityChange(value: string) {
    setSeverity(value);
    if (value === "HIGH" && !severityHintDismissed) {
      setNotifyParent(true);
    }
  }

  function toggleStudent(id: string) {
    setSelectedStudents((current) =>
      current.includes(id)
        ? current.filter((studentId) => studentId !== id)
        : [...current, id],
    );
  }

  async function submitIncident(skipHighSeverityCheck = false) {
    if (
      !skipHighSeverityCheck &&
      severity === "HIGH" &&
      !notifyParent
    ) {
      setShowHighSeverityConfirm(true);
      return;
    }

    if (!title.trim() || !description.trim() || selectedStudents.length === 0) {
      return;
    }
    setIsSaving(true);

    const response = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        location: location || undefined,
        severity,
        studentIds: selectedStudents,
        notifyParent,
        parentMessageBody: notifyParent ? parentMessage : undefined,
      }),
    });

    setIsSaving(false);
    setShowHighSeverityConfirm(false);
    if (!response.ok) {
      toast.error("Could not file incident");
      return;
    }

    toast.success(
      notifyParent
        ? "Incident filed — parent notified via app link (no sensitive content in SMS/email)"
        : "Incident filed",
    );
    setTitle("");
    setDescription("");
    setLocation("");
    setParentMessage("");
    router.refresh();
    const reload = await fetch("/api/incidents");
    if (reload.ok) {
      const data = await reload.json();
      setIncidents(data.incidents ?? []);
    }
  }

  async function createIncident(event: React.FormEvent) {
    event.preventDefault();
    await submitIncident();
  }

  const severityStatus = (value: string) => {
    if (value === "HIGH") return "danger" as const;
    if (value === "MEDIUM") return "warning" as const;
    return "neutral" as const;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Structured safety reports. Severity does not auto-send notifications in v1 — parent notify is always a manual staff choice."
      />

      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="font-medium">v1 notification behavior</p>
        <p className="mt-1 text-muted-foreground">
          Severity does <strong>not</strong> trigger automatic parent SMS, admin alerts, or
          routing. &quot;Notify parent&quot; is a manual checkbox only. HIGH severity
          pre-checks the box as a <strong>suggestion</strong> — staff can still uncheck it.
          Auto-routing by severity is planned for a later release.
        </p>
      </div>

      {canEdit && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">File incident report</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createIncident} className="space-y-4">
              <div className="space-y-2">
                <Label>Students involved</Label>
                <div className="flex flex-wrap gap-2">
                  {students.map((student) => {
                    const active = selectedStudents.includes(student.id);
                    return (
                      <button
                        key={student.id}
                        type="button"
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          active ? "border-primary bg-primary/10" : "bg-muted/30"
                        }`}
                        onClick={() => toggleStudent(student.id)}
                      >
                        {student.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-title">Title</Label>
                <Input
                  id="incident-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-desc">Description</Label>
                <Textarea
                  id="incident-desc"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  rows={4}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="incident-location">Location</Label>
                  <Input
                    id="incident-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incident-severity">Severity</Label>
                  <select
                    id="incident-severity"
                    className="min-h-11 w-full rounded-xl border bg-background px-3"
                    value={severity}
                    onChange={(event) => onSeverityChange(event.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyParent}
                  onChange={(event) => {
                    setNotifyParent(event.target.checked);
                    if (!event.target.checked) setSeverityHintDismissed(true);
                  }}
                />
                Notify parent (manual — notification-only SMS/email, view details in app)
              </label>
              {severity === "HIGH" && notifyParent && (
                <p className="text-xs text-amber-700">
                  Suggested for HIGH severity — not sent automatically.
                </p>
              )}
              {notifyParent && (
                <div className="space-y-2">
                  <Label htmlFor="parent-msg">Message to parent (in-app thread)</Label>
                  <Textarea
                    id="parent-msg"
                    value={parentMessage}
                    onChange={(event) => setParentMessage(event.target.value)}
                    rows={3}
                    required={notifyParent}
                  />
                </div>
              )}
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Filing..." : "File incident"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading incidents...</p>
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No incidents logged"
          description="Safety events you file will appear here with severity and status."
        />
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <Card key={incident.id} className="rounded-2xl">
              <CardContent className="space-y-2 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{incident.title}</p>
                  <StatusBadge
                    status={severityStatus(incident.severity)}
                    label={incident.severity}
                  />
                  <StatusBadge status="info" label={incident.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {incident.students.join(", ")} · {incident.reportedByName} ·{" "}
                  {new Date(incident.createdAt).toLocaleString()}
                  {incident.location ? ` · ${incident.location}` : ""}
                </p>
                <p className="text-sm">{incident.description}</p>
                {incident.hasParentThread && (
                  <p className="text-xs text-muted-foreground">
                    Linked parent thread — sensitive delivery rules apply
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showHighSeverityConfirm} onOpenChange={setShowHighSeverityConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>High severity — notify parent?</DialogTitle>
            <DialogDescription>
              This incident is marked <strong>high severity</strong>. Are you sure you
              don&apos;t want to notify the parent? You can still file without notifying.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              className="min-h-11 w-full"
              onClick={() => {
                setNotifyParent(true);
                setShowHighSeverityConfirm(false);
              }}
            >
              Go back and notify parent
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={isSaving}
              onClick={() => void submitIncident(true)}
            >
              {isSaving ? "Filing..." : "File without notifying parent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
