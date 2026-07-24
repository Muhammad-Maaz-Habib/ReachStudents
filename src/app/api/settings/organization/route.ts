import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { organizationBrandingSchema } from "@/lib/validations/settings";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
    },
  });

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ organization });
}

/**
 * Update org display name + logo URL.
 * Super Admin only. Logo is a URL (no file upload storage in v1).
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = organizationBrandingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const organization = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      name: parsed.data.name,
      logoUrl: parsed.data.logoUrl,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
    },
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "update",
    targetRecord: organization.id,
    metadata: {
      area: "organization_branding",
      name: organization.name,
      logoUrl: organization.logoUrl,
    },
  });

  return NextResponse.json({ organization });
}
