"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Calendar,
  RefreshCw,
  Upload,
  UserCog,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/design-system/status-badge";
import { CertificationAlertsPanel } from "@/components/staff/certification-alerts-panel";
import { StaffTeamEditor } from "@/components/staff/staff-team-editor";
import { ImportStaffDialog } from "@/components/staff/import-staff-dialog";
import { DeactivateStaffButton } from "@/components/staff/deactivate-staff-button";
import { cn } from "@/lib/utils";

type Tab = "roster" | "directory" | "swaps" | "resources";

type Shift = {
  id: string;
  userId: string;
  userName: string | null;
  date: string;
  dutyLabel: string;
  requiredCertification: string | null;
  startTime: string | null;
  isOwn: boolean;
};

type StaffMember = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  teams: string[];
  teamIds: string[];
  emergencyContact1Name: string | null;
  emergencyContact1Phone: string | null;
  emergencyContact2Name: string | null;
  emergencyContact2Phone: string | null;
  foodAllergy: string | null;
  dietaryRestriction: string | null;
  dietaryOther: string | null;
  certifications: {
    type: string;
    label: string | null;
    expiresAt: string | null;
  }[];
};

type TeamOption = { id: string; name: string; color: string | null };

type Swap = {
  id: string;
  status: string;
  coverageIssue: string | null;
  canAccept: boolean;
  isRequester: boolean;
  requesterShift: { id: string; dutyLabel: string; date: string; userName: string | null };
  targetShift: { id: string; dutyLabel: string; date: string; userName: string | null };
};

type Resource = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string | null;
};

type StaffHubProps = {
  canManage: boolean;
  canViewCertAlerts: boolean;
};

export function StaffHub({ canManage, canViewCertAlerts }: StaffHubProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("roster");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [availableTeams, setAvailableTeams] = useState<TeamOption[]>([]);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [myShiftId, setMyShiftId] = useState("");
  const [targetShiftId, setTargetShiftId] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  async function loadRoster() {
    const response = await fetch("/api/staff/shifts");
    if (!response.ok) return;
    const data = await response.json();
    setShifts(data.shifts ?? []);
  }

  async function loadAll() {
    const [dirRes, swapRes, resRes] = await Promise.all([
      fetch("/api/staff/directory"),
      fetch("/api/staff/swaps"),
      fetch("/api/staff/resources"),
    ]);
    if (dirRes.ok) {
      const data = await dirRes.json();
      setStaff(
        (data.staff ?? []).map(
          (member: StaffMember & { teamIds?: string[] }) => ({
            ...member,
            teamIds: member.teamIds ?? [],
          }),
        ),
      );
      setAvailableTeams(data.teams ?? []);
    }
    if (swapRes.ok) {
      const data = await swapRes.json();
      setSwaps(data.swaps ?? []);
    }
    if (resRes.ok) {
      const data = await resRes.json();
      setResources(data.resources ?? []);
    }
    await loadRoster();
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const myShifts = shifts.filter((shift) => shift.isOwn);
  const otherShifts = shifts.filter((shift) => !shift.isOwn);

  async function requestSwap(event: React.FormEvent) {
    event.preventDefault();
    if (!myShiftId || !targetShiftId) return;
    const response = await fetch("/api/staff/swaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requesterShiftId: myShiftId,
        targetShiftId,
      }),
    });
    if (!response.ok) {
      toast.error("Could not request swap");
      return;
    }
    toast.success("Swap requested — waiting for other staff to accept");
    setMyShiftId("");
    setTargetShiftId("");
    router.refresh();
    await loadAll();
  }

  async function swapAction(id: string, action: string) {
    const response = await fetch(`/api/staff/swaps/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error("Action failed");
      return;
    }
    toast.success(data.message ?? `Swap ${data.status.toLowerCase()}`);
    await loadAll();
  }

  const tabs: { id: Tab; label: string; icon: typeof Calendar }[] = [
    { id: "roster", label: "Duty roster", icon: Calendar },
    { id: "directory", label: "Directory", icon: Users },
    { id: "swaps", label: "Shift swaps", icon: RefreshCw },
    { id: "resources", label: "Resources", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Duty roster, directory, peer shift swaps with coverage checks, and internal resources."
      />

      {canViewCertAlerts && <CertificationAlertsPanel />}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={tab === item.id ? "default" : "outline"}
            className="min-h-11"
            onClick={() => setTab(item.id)}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Button>
        ))}
      </div>

      {tab === "roster" && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Who&apos;s on duty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {shifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shifts scheduled yet.</p>
            ) : (
              shifts.map((shift) => (
                <div
                  key={shift.id}
                  className={cn(
                    "rounded-xl border p-3 text-sm",
                    shift.isOwn && "border-primary/40 bg-primary/5",
                  )}
                >
                  <p className="font-medium">
                    {shift.dutyLabel} · {shift.userName ?? "Staff"}
                  </p>
                  <p className="text-muted-foreground">
                    {shift.date}
                    {shift.startTime
                      ? ` · ${new Date(shift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                      : ""}
                    {shift.requiredCertification
                      ? ` · Requires ${shift.requiredCertification}`
                      : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === "directory" && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button
                type="button"
                className="min-h-11"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="size-4" aria-hidden />
                Upload CSV
              </Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
          {staff.map((member) => (
            <Card key={member.id} className="rounded-2xl">
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserCog className="size-4 text-muted-foreground" aria-hidden />
                    <p className="font-semibold">{member.name ?? member.email}</p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <StaffTeamEditor
                        staffId={member.id}
                        staffName={member.name ?? member.email}
                        initialTeamIds={member.teamIds}
                        availableTeams={availableTeams}
                        onSaved={(teamIds, teamNames) => {
                          setStaff((current) =>
                            current.map((row) =>
                              row.id === member.id
                                ? { ...row, teamIds, teams: teamNames }
                                : row,
                            ),
                          );
                        }}
                      />
                      <DeactivateStaffButton
                        staffId={member.id}
                        staffName={member.name ?? member.email}
                        staffEmail={member.email}
                        onDeactivated={() => {
                          setStaff((current) =>
                            current.filter((row) => row.id !== member.id),
                          );
                        }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {member.role.replace(/_/g, " ")}
                </p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
                <p className="text-sm text-muted-foreground">
                  Teams:{" "}
                  {member.teams.length > 0 ? member.teams.join(", ") : "None"}
                </p>
                {member.phone && (
                  <p className="text-sm text-muted-foreground">{member.phone}</p>
                )}
                {(member.emergencyContact1Name || member.emergencyContact1Phone) && (
                  <p className="text-sm text-muted-foreground">
                    Emergency 1:{" "}
                    {[member.emergencyContact1Name, member.emergencyContact1Phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {(member.emergencyContact2Name || member.emergencyContact2Phone) && (
                  <p className="text-sm text-muted-foreground">
                    Emergency 2:{" "}
                    {[member.emergencyContact2Name, member.emergencyContact2Phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {(member.foodAllergy ||
                  member.dietaryRestriction ||
                  member.dietaryOther) && (
                  <p className="text-sm text-muted-foreground">
                    Dietary:{" "}
                    {[
                      member.foodAllergy && `Allergy: ${member.foodAllergy}`,
                      member.dietaryRestriction,
                      member.dietaryOther,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {member.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {member.certifications.map((cert) => (
                      <StatusBadge
                        key={`${member.id}-${cert.type}`}
                        status="info"
                        label={cert.label ?? cert.type}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          </div>
          <ImportStaffDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            onImported={() => void loadAll()}
          />
        </div>
      )}

      {tab === "swaps" && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
            <p className="font-medium">How swap approval works</p>
            <p className="mt-1 text-muted-foreground">
              Both staff confirm the swap. If coverage checks pass (required certifications,
              no double-booking), the roster updates automatically. If not — e.g. lifeguard
              cert missing — the swap goes to Session Admin for sign-off.
            </p>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Request a swap</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={requestSwap} className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Your shift</Label>
                  <select
                    className="min-h-11 w-full rounded-xl border bg-background px-3"
                    value={myShiftId}
                    onChange={(event) => setMyShiftId(event.target.value)}
                    required
                  >
                    <option value="">Select your duty</option>
                    {myShifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.dutyLabel} ({shift.date})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Swap with</Label>
                  <select
                    className="min-h-11 w-full rounded-xl border bg-background px-3"
                    value={targetShiftId}
                    onChange={(event) => setTargetShiftId(event.target.value)}
                    required
                  >
                    <option value="">Select their duty</option>
                    {otherShifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.dutyLabel} — {shift.userName} ({shift.date})
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="min-h-11 sm:col-span-2">
                  Request swap
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {swaps.map((swap) => (
              <Card key={swap.id} className="rounded-2xl">
                <CardContent className="space-y-2 pt-6 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status="info" label={swap.status.replace(/_/g, " ")} />
                  </div>
                  <p>
                    {swap.requesterShift.userName}&apos;s {swap.requesterShift.dutyLabel} (
                    {swap.requesterShift.date}) ↔ {swap.targetShift.userName}&apos;s{" "}
                    {swap.targetShift.dutyLabel} ({swap.targetShift.date})
                  </p>
                  {swap.coverageIssue && (
                    <p className="text-amber-700">{swap.coverageIssue}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {swap.canAccept && (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-9"
                        onClick={() => void swapAction(swap.id, "accept")}
                      >
                        Accept swap
                      </Button>
                    )}
                    {swap.isRequester && swap.status === "PENDING_ACCEPTANCE" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-9"
                        onClick={() => void swapAction(swap.id, "cancel")}
                      >
                        Cancel
                      </Button>
                    )}
                    {canManage && swap.status === "PENDING_ADMIN" && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-9"
                          onClick={() => void swapAction(swap.id, "approve")}
                        >
                          Approve override
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-9"
                          onClick={() => void swapAction(swap.id, "reject")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "resources" && (
        <div className="space-y-3">
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources uploaded yet.</p>
          ) : (
            resources.map((resource) => (
              <Card key={resource.id} className="rounded-2xl">
                <CardContent className="pt-6">
                  <p className="font-medium">{resource.title}</p>
                  <p className="text-xs text-muted-foreground">{resource.category}</p>
                  {resource.description && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {resource.description}
                    </p>
                  )}
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm text-primary underline"
                    >
                      Open resource
                    </a>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
