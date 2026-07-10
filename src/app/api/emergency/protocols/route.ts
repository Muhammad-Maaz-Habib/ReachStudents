import { NextResponse } from "next/server";
import { EmergencyProtocolType } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { DEFAULT_EMERGENCY_PROTOCOLS } from "@/lib/emergency/default-protocols";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/constants";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const template of DEFAULT_EMERGENCY_PROTOCOLS) {
    await prisma.emergencyProtocol.upsert({
      where: {
        organizationId_type: {
          organizationId: session.user.organizationId,
          type: template.type,
        },
      },
      update: {},
      create: {
        organizationId: session.user.organizationId,
        type: template.type,
        title: template.title,
        steps: template.steps,
        sortOrder: template.sortOrder,
      },
    });
  }

  const protocols = await prisma.emergencyProtocol.findMany({
    where: {
      organizationId: session.user.organizationId,
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    protocols: protocols.map((protocol) => ({
      id: protocol.id,
      type: protocol.type,
      title: protocol.title,
      steps: protocol.steps,
      sortOrder: protocol.sortOrder,
      updatedAt: protocol.updatedAt.toISOString(),
    })),
  });
}
