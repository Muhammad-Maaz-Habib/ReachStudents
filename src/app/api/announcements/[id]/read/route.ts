import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.MESSAGING,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const announcement = await prisma.announcement.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!announcement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const read = await prisma.announcementRead.upsert({
    where: {
      announcementId_userId: {
        announcementId: id,
        userId: session.user.id,
      },
    },
    update: { readAt: new Date() },
    create: {
      announcementId: id,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ readAt: read.readAt.toISOString() });
}
