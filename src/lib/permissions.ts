import { PermissionResource, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_PERMISSIONS: Record<
  UserRole,
  Partial<Record<PermissionResource, { canView: boolean; canEdit: boolean }>>
> = {
  [UserRole.SUPER_ADMIN]: Object.fromEntries(
    Object.values(PermissionResource).map((resource) => [
      resource,
      { canView: true, canEdit: true },
    ]),
  ) as Record<PermissionResource, { canView: boolean; canEdit: boolean }>,
  [UserRole.SESSION_ADMIN]: {
    [PermissionResource.STUDENTS]: { canView: true, canEdit: true },
    [PermissionResource.HEALTH_RECORDS]: { canView: true, canEdit: false },
    [PermissionResource.MESSAGING]: { canView: true, canEdit: true },
    [PermissionResource.SCHEDULES]: { canView: true, canEdit: true },
    [PermissionResource.FORMS]: { canView: true, canEdit: true },
    [PermissionResource.INCIDENTS]: { canView: true, canEdit: true },
    [PermissionResource.REPORTS]: { canView: true, canEdit: false },
    [PermissionResource.SETTINGS]: { canView: true, canEdit: true },
  },
  [UserRole.STAFF]: {
    [PermissionResource.STUDENTS]: { canView: true, canEdit: false },
    [PermissionResource.MESSAGING]: { canView: true, canEdit: true },
    [PermissionResource.SCHEDULES]: { canView: true, canEdit: false },
    [PermissionResource.FORMS]: { canView: true, canEdit: false },
    [PermissionResource.INCIDENTS]: { canView: true, canEdit: true },
  },
  [UserRole.NURSE]: {
    [PermissionResource.STUDENTS]: { canView: true, canEdit: false },
    [PermissionResource.HEALTH_RECORDS]: { canView: true, canEdit: true },
    [PermissionResource.INCIDENTS]: { canView: true, canEdit: true },
  },
  [UserRole.PARENT]: {
    [PermissionResource.STUDENTS]: { canView: true, canEdit: false },
    [PermissionResource.MESSAGING]: { canView: true, canEdit: true },
    [PermissionResource.SCHEDULES]: { canView: true, canEdit: false },
    [PermissionResource.FORMS]: { canView: true, canEdit: true },
    [PermissionResource.INCIDENTS]: { canView: true, canEdit: false },
  },
  [UserRole.STUDENT]: {
    [PermissionResource.SCHEDULES]: { canView: true, canEdit: false },
    [PermissionResource.MESSAGING]: { canView: true, canEdit: false },
  },
};

export async function seedDefaultPermissions(organizationId: string) {
  const entries = Object.entries(DEFAULT_PERMISSIONS).flatMap(([role, resources]) =>
    Object.entries(resources).map(([resource, perms]) => ({
      organizationId,
      role: role as UserRole,
      resource: resource as PermissionResource,
      canView: perms.canView,
      canEdit: perms.canEdit,
    })),
  );

  await prisma.permissionMatrix.createMany({
    data: entries,
    skipDuplicates: true,
  });
}

export async function hasPermission(
  organizationId: string,
  role: UserRole,
  resource: PermissionResource,
  action: "view" | "edit",
): Promise<boolean> {
  if (role === UserRole.SUPER_ADMIN) return true;

  const permission = await prisma.permissionMatrix.findUnique({
    where: {
      organizationId_role_resource: {
        organizationId,
        role,
        resource,
      },
    },
  });

  if (!permission) {
    const fallback = DEFAULT_PERMISSIONS[role]?.[resource];
    if (!fallback) return false;
    return action === "view" ? fallback.canView : fallback.canEdit;
  }

  return action === "view" ? permission.canView : permission.canEdit;
}
