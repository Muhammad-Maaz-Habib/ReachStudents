import { sendEmail } from "@/lib/notifications/email";
import { getNotificationConfig } from "@/lib/notifications/config";
import { isSensitiveParentThread } from "@/lib/messaging/thread-delivery-shared";
import { ParentThreadTopic } from "@/generated/prisma/client";

/**
 * Email an incident notice to an arbitrary address (not the linked guardian).
 * Uses the same sensitive-scoping rules as parent incident delivery:
 * notification + app link only — never the full report body in plaintext.
 */
export async function deliverIncidentExternalEmail(params: {
  to: string;
  organizationName: string;
  studentNames: string[];
  incidentTitle: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  senderName: string;
  incidentId: string;
}) {
  const config = getNotificationConfig();
  const sensitive = isSensitiveParentThread({
    topic: ParentThreadTopic.INCIDENT,
    incidentId: params.incidentId,
  });

  // Incidents are always treated as sensitive; keep this check explicit so
  // future topic changes stay aligned with parent delivery.
  const notificationOnly = sensitive || params.severity === "HIGH";
  const viewUrl = `${config.appUrl}/incidents`;
  const names =
    params.studentNames.length > 0
      ? params.studentNames.join(", ")
      : "a student";

  const subject = notificationOnly
    ? `Incident notice — ${names} (${params.organizationName})`
    : `Incident report: ${params.incidentTitle} — ${params.organizationName}`;

  const text = notificationOnly
    ? [
        `${params.senderName} filed an incident report involving ${names}.`,
        `Severity: ${params.severity}`,
        "",
        "For privacy, the report details are only available in Waypoint.",
        `Sign in to view: ${viewUrl}`,
      ].join("\n")
    : [
        `${params.senderName} filed an incident report.`,
        `Title: ${params.incidentTitle}`,
        `Students: ${names}`,
        `Severity: ${params.severity}`,
        "",
        `View in Waypoint: ${viewUrl}`,
      ].join("\n");

  return sendEmail({ to: params.to, subject, text });
}

/** Parse a free-text field into unique, valid-looking emails. */
export function parseNotifyEmails(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}
