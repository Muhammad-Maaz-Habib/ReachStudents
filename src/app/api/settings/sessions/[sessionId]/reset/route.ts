import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { campSessionResetSchema } from "@/lib/validations/settings";
import { resetCampSessionOperationalData } from "@/lib/sessions/reset-session";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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

  const { sessionId } = await context.params;
  const body = await request.json();
  const parsed = campSessionResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campSession = await prisma.campSession.findFirst({
    where: {
      id: sessionId,
      organizationId: session.user.organizationId,
    },
  });
  if (!campSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.confirmName.trim() !== campSession.name) {
    return NextResponse.json(
      {
        error:
          "Confirmation text must exactly match the session name to reset",
      },
      { status: 400 },
    );
  }

  const result = await resetCampSessionOperationalData(
    session.user.organizationId,
    sessionId,
  );

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "delete",
    targetRecord: sessionId,
    metadata: {
      area: "session_reset",
      name: campSession.name,
      deleted: result.deleted,
      preserved: result.preserved,
    },
  });

  const refreshed = await prisma.campSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { _count: { select: { teams: true, students: true } } },
  });

  return NextResponse.json({
    ok: true,
    session: refreshed,
    reset: result,
  });
}
