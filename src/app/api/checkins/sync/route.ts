import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { processCheckInSyncBatch } from "@/lib/checkin/server";
import { canCheckInStudent } from "@/lib/staff/team-access";
import { z } from "zod";

const syncSchema = z.object({
  events: z.array(
    z.object({
      clientEventId: z.string().uuid(),
      type: z.enum(["check_in", "check_out"]),
      studentId: z.string().min(1),
      activityId: z.string().nullable(),
      staffId: z.string().min(1),
      method: z.enum(["tap", "qr"]),
      clientTimestamp: z.string(),
    }),
  ),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canView = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.STUDENTS,
    "view",
  );
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid sync payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  for (const event of parsed.data.events) {
    const allowed = await canCheckInStudent(
      session.user.id,
      session.user.role,
      session.user.organizationId,
      event.studentId,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden", studentId: event.studentId },
        { status: 403 },
      );
    }
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const result = await processCheckInSyncBatch(
    campSession.id,
    session.user.id,
    parsed.data.events,
  );

  return NextResponse.json(result);
}
