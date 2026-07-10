import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { emergencyProtocolUpdateSchema } from "@/lib/validations/emergency";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ type: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type } = await context.params;
  const body = await request.json();
  const parsed = emergencyProtocolUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const protocol = await prisma.emergencyProtocol.update({
    where: {
      organizationId_type: {
        organizationId: session.user.organizationId,
        type: type as never,
      },
    },
    data: parsed.data,
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.EMERGENCY_PROTOCOL,
    action: "update",
    targetRecord: protocol.id,
    metadata: { type: protocol.type },
  });

  return NextResponse.json({
    id: protocol.id,
    type: protocol.type,
    title: protocol.title,
    steps: protocol.steps,
  });
}
