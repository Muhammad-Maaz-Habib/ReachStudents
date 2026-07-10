import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/constants";
import { staffResourceSchema } from "@/lib/validations/staff";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resources = await prisma.staffResource.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });

  return NextResponse.json({
    resources: resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      category: resource.category,
      url: resource.url,
      createdAt: resource.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.SETTINGS,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = staffResourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const resource = await prisma.staffResource.create({
    data: {
      organizationId: session.user.organizationId,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      url: parsed.data.url || null,
    },
  });

  return NextResponse.json({ id: resource.id });
}
