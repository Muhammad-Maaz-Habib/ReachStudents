import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { NextResponse } from "next/server";

export async function requireStudentAccess(action: "view" | "edit") {
  const session = await auth();
  const user = session?.user;

  if (!user?.organizationId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const allowed = await hasPermission(
    user.organizationId,
    user.role,
    PermissionResource.STUDENTS,
    action,
  );

  if (!allowed) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user };
}

export const studentInclude = {
  team: true,
  medicalProfile: true,
  emergencyContacts: {
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  },
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      mustChangePassword: true,
    },
  },
  _count: {
    select: {
      formSubmissions: true,
      checkIns: true,
    },
  },
} satisfies Prisma.StudentInclude;

export type StudentWithRelations = Prisma.StudentGetPayload<{
  include: typeof studentInclude;
}>;
