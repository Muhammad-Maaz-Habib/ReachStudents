import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { seedDefaultPermissions } from "@/lib/permissions";
import { onboardingSchema } from "@/lib/validations/auth";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      organizationName,
      sessionName,
      startDate,
      endDate,
      adminName,
      email,
      password,
    } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const baseSlug = slugify(organizationName);
    let slug = baseSlug;
    let suffix = 1;

    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
        },
      });

      await tx.campSession.create({
        data: {
          organizationId: org.id,
          name: sessionName,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      });

      await tx.user.create({
        data: {
          organizationId: org.id,
          email: email.toLowerCase(),
          name: adminName,
          passwordHash,
          role: UserRole.SUPER_ADMIN,
        },
      });

      return org;
    });

    await seedDefaultPermissions(organization.id);

    return NextResponse.json({ success: true, organizationId: organization.id });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 },
    );
  }
}
