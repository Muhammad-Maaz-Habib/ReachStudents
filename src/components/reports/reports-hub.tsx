"use client";

import { useEffect, useState } from "react";
import { Download, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AUDIT_RESOURCES } from "@/lib/audit/constants";
import { cn } from "@/lib/utils";

type AuditLogRow = {
  id: string;
  resource: string;
  action: string;
  targetRecord: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { name: string | null; email: string; role: string };
};

const RESOURCE_FILTER_OPTIONS = [
  { value: "all", label: "All resources" },
  { value: AUDIT_RESOURCES.HEALTH_RECORDS, label: "Health records" },
  { value: AUDIT_RESOURCES.CONFIDENTIAL_NOTES, label: "Confidential notes" },
  { value: AUDIT_RESOURCES.INCIDENTS, label: "Incidents" },
  { value: AUDIT_RESOURCES.SETTINGS, label: "Settings" },
  { value: AUDIT_RESOURCES.EMERGENCY_PROTOCOL, label: "Emergency protocols" },
  { value: AUDIT_RESOURCES.REPORTS, label: "Reports" },
];

const EXPORT_LINKS = [
  { href: "/api/reports/export?type=attendance", label: "Attendance (open check-ins)" },
  { href: "/api/reports/export?type=incidents", label: "Incident reports" },
  { href: "/api/reports/export?type=medications", label: "Medication administration logs" },
  { href: "/api/reports/export?type=forms", label: "Form completion status" },
  { href: "/api/reports/export?type=communications", label: "Communications (announcements & messages)" },
];

function actionBadgeStatus(action: string) {
  if (action === "view") return "info" as const;
  if (action === "create") return "success" as const;
  if (action === "update") return "warning" as const;
  if (action === "delete") return "danger" as const;
  return "neutral" as const;
}

export function ReportsHub() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [resourceFilter, setResourceFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (resourceFilter !== "all") params.set("resource", resourceFilter);
      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      setLogs(data.logs ?? []);
    }
    void load();
  }, [resourceFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="CSV exports and compliance audit trail for sensitive records."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="size-5" aria-hidden />
              CSV exports
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {EXPORT_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(buttonVariants({ variant: "outline" }), "min-h-11 justify-start")}
              >
                {link.label}
              </a>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-amber-200/50 bg-amber-50/20 dark:border-amber-900/30 dark:bg-amber-950/10">
          <CardContent className="space-y-2 pt-6 text-sm">
            <p className="font-medium">Audit log policy</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Append-only — no update/delete API for audit rows</li>
              <li>Writes are fire-and-forget (non-blocking)</li>
              <li>
                <code>view</code> events only for sensitive access (confidential
                notes, medical profile on student record)
              </li>
              <li>Create/update/export always logged</li>
            </ul>
            <p className="text-muted-foreground">See <code>docs/AUDIT_LOG.md</code></p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="size-5" aria-hidden />
            Audit log
          </CardTitle>
          <Select
            value={resourceFilter}
            onValueChange={(value) => setResourceFilter(value ?? "all")}
          >
            <SelectTrigger className="min-h-10 w-52" aria-label="Filter audit log by resource">
              <SelectValue placeholder="Filter resource" />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Compliance audit log entries</caption>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">When</th>
                  <th scope="col" className="py-2 pr-3 font-medium">User</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Resource</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Action</th>
                  <th scope="col" className="py-2 font-medium">Target</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <time dateTime={log.createdAt}>
                        {new Date(log.createdAt).toLocaleString()}
                      </time>
                    </td>
                    <td className="py-2 pr-3">
                      {log.user.name ?? log.user.email}
                      <span className="block text-xs text-muted-foreground">
                        {log.user.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{log.resource.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge
                        status={actionBadgeStatus(log.action)}
                        label={log.action}
                      />
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {log.targetRecord ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
