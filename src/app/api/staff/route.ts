import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { importStaffRecord } from "@/lib/staff/staff-service";
import { staffFormSchema } from "@/lib/validations/staff";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = staffFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const data = parsed.data;
  const teamName = data.teamId
    ? campSession.teams.find((team) => team.id === data.teamId)?.name
    : undefined;

  if (data.teamId && !teamName) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }

  try {
    const result = await importStaffRecord({
      organizationId: session.user.organizationId,
      sessionId: campSession.id,
      teams: campSession.teams,
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        role: data.role,
        email: data.email,
        phone: data.phone,
        team: teamName,
        emergency_contact_1_name: data.emergencyContact1Name,
        emergency_contact_1_phone: data.emergencyContact1Phone,
        emergency_contact_2_name: data.emergencyContact2Name,
        emergency_contact_2_phone: data.emergencyContact2Phone,
        food_allergy: data.foodAllergy,
        dietary_restriction: data.dietaryRestriction,
        dietary_other: data.dietaryOther,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        emergencyContact1Name: true,
        emergencyContact1Phone: true,
        emergencyContact2Name: true,
        emergencyContact2Phone: true,
        foodAllergy: true,
        dietaryRestriction: true,
        dietaryOther: true,
      },
    });

    logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      resource: AUDIT_RESOURCES.SETTINGS,
      action: result.action === "imported" ? "create" : "update",
      targetRecord: user.id,
      metadata: { area: "staff_manual_add", email: user.email },
    });

    return NextResponse.json(
      {
        user,
        action: result.action,
        temporaryPassword: result.temporaryPassword ?? null,
        warning: result.warning ?? null,
      },
      { status: result.action === "imported" ? 201 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save staff member";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
