import { UserRole } from "@/generated/prisma/client";

const CONFIDENTIAL_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SESSION_ADMIN,
  UserRole.NURSE,
];

export function canViewConfidentialNotes(role: UserRole) {
  return CONFIDENTIAL_ROLES.includes(role);
}

export function canEditConfidentialNotes(role: UserRole) {
  return CONFIDENTIAL_ROLES.includes(role);
}
