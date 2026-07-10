import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { getFormTemplate } from "@/lib/forms/templates";
import { createFormSchema } from "@/lib/validations/forms";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.FORMS,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const totalStudents = await prisma.student.count({
    where: { sessionId: campSession.id },
  });

  const forms = await prisma.form.findMany({
    where: {
      organizationId: session.user.organizationId,
      sessionId: campSession.id,
      isActive: true,
    },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    forms: forms.map((form) => ({
      id: form.id,
      title: form.title,
      type: form.type,
      deadline: form.deadline?.toISOString() ?? null,
      totalStudents,
      completedCount: form._count.submissions,
      missingCount: Math.max(0, totalStudents - form._count.submissions),
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
    PermissionResource.FORMS,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = getFormTemplate(parsed.data.templateType);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const form = await prisma.form.create({
    data: {
      organizationId: session.user.organizationId,
      sessionId: campSession.id,
      title: parsed.data.title ?? template.title,
      type: template.type,
      description: parsed.data.description ?? template.description,
      fields: template.fields,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
    },
  });

  return NextResponse.json({ id: form.id });
}
