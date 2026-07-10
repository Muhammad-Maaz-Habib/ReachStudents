import { PermissionResource, UserRole } from "@/generated/prisma/browser";

export const APP_NAME = "Waypoint";

export const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SESSION_ADMIN,
  UserRole.STAFF,
  UserRole.NURSE,
];

export const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SESSION_ADMIN,
];

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "Super Admin",
  [UserRole.SESSION_ADMIN]: "Session Admin",
  [UserRole.STAFF]: "Staff / Counselor",
  [UserRole.NURSE]: "Nurse / Health",
  [UserRole.PARENT]: "Parent / Guardian",
  [UserRole.STUDENT]: "Student",
};

export const RESOURCE_LABELS: Record<PermissionResource, string> = {
  [PermissionResource.STUDENTS]: "Students",
  [PermissionResource.HEALTH_RECORDS]: "Health Records",
  [PermissionResource.FINANCIALS]: "Financials",
  [PermissionResource.MESSAGING]: "Messaging",
  [PermissionResource.SCHEDULES]: "Schedules",
  [PermissionResource.FORMS]: "Forms",
  [PermissionResource.INCIDENTS]: "Incidents",
  [PermissionResource.REPORTS]: "Reports",
  [PermissionResource.SETTINGS]: "Settings",
};

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/roster", label: "Roster", icon: "Users" },
  { href: "/checkin", label: "Check-In", icon: "QrCode" },
  { href: "/schedule", label: "Schedule", icon: "Calendar" },
  { href: "/messages", label: "Messages", icon: "MessageSquare" },
  { href: "/announcements", label: "Announcements", icon: "Megaphone" },
  { href: "/health", label: "Health", icon: "HeartPulse" },
  { href: "/incidents", label: "Incidents", icon: "AlertTriangle" },
  { href: "/forms", label: "Forms", icon: "FileText" },
  { href: "/staff", label: "Staff", icon: "UserCog" },
  { href: "/reports", label: "Reports", icon: "BarChart3" },
  { href: "/emergency", label: "Emergency", icon: "Siren" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;

export const PARENT_NAV_ITEMS = [
  { href: "/parent/dashboard", label: "Home", icon: "Home" },
  { href: "/parent/messages", label: "Messages", icon: "MessageSquare" },
  { href: "/parent/forms", label: "Forms", icon: "FileText" },
  { href: "/parent/incidents", label: "Incidents", icon: "AlertTriangle" },
] as const;
