export const AUDIT_RESOURCES = {
  HEALTH_RECORDS: "HEALTH_RECORDS",
  CONFIDENTIAL_NOTES: "CONFIDENTIAL_NOTES",
  INCIDENTS: "INCIDENTS",
  SETTINGS: "SETTINGS",
  EMERGENCY_PROTOCOL: "EMERGENCY_PROTOCOL",
  REPORTS: "REPORTS",
} as const;

export type AuditResource = (typeof AUDIT_RESOURCES)[keyof typeof AUDIT_RESOURCES];

export type AuditAction = "view" | "create" | "update" | "delete" | "export";
