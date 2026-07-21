import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import {
  CUSTOM_FORM_TYPE,
  getFormTemplate,
  type FormFieldDefinition,
} from "@/lib/forms/templates";
import { createFormSchema } from "@/lib/validations/forms";
import type { Prisma } from "@/generated/prisma/client";

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

  const [forms, customTemplates] = await Promise.all([
    prisma.form.findMany({
      where: {
        organizationId: session.user.organizationId,
        sessionId: campSession.id,
        isActive: true,
      },
      include: { _count: { select: { submissions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.form.findMany({
      where: {
        organizationId: session.user.organizationId,
        sessionId: null,
        type: CUSTOM_FORM_TYPE,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        fields: true,
        updatedAt: true,
      },
    }),
  ]);

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
    customTemplates: customTemplates.map((template) => ({
      id: template.id,
      title: template.title,
      description: template.description,
      type: template.type,
      fieldCount: (template.fields as FormFieldDefinition[]).length,
      updatedAt: template.updatedAt.toISOString(),
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

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const organizationId = session.user.organizationId;

  if (parsed.data.source === "template") {
    const template = getFormTemplate(parsed.data.templateType);
    if (!template) {
      return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    }

    const form = await prisma.form.create({
      data: {
        organizationId,
        sessionId: campSession.id,
        title: parsed.data.title ?? template.title,
        type: template.type,
        description: parsed.data.description ?? template.description,
        fields: template.fields as unknown as Prisma.InputJsonValue,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
      },
    });

    return NextResponse.json({ id: form.id });
  }

  if (parsed.data.source === "publish_custom") {
    const template = await prisma.form.findFirst({
      where: {
        id: parsed.data.templateId,
        organizationId,
        sessionId: null,
        type: CUSTOM_FORM_TYPE,
        isActive: true,
      },
    });
    if (!template) {
      return NextResponse.json(
        { error: "Custom template not found" },
        { status: 404 },
      );
    }

    const form = await prisma.form.create({
      data: {
        organizationId,
        sessionId: campSession.id,
        title: parsed.data.title ?? template.title,
        type: CUSTOM_FORM_TYPE,
        description: template.description,
        fields: template.fields as Prisma.InputJsonValue,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
      },
    });

    return NextResponse.json({ id: form.id, publishedFrom: template.id });
  }

  // source === "custom"
  const fields = parsed.data.fields as unknown as Prisma.InputJsonValue;
  let templateId: string | undefined;
  let publishedId: string | undefined;

  if (parsed.data.saveAsTemplate) {
    const template = await prisma.form.create({
      data: {
        organizationId,
        sessionId: null,
        title: parsed.data.title,
        type: CUSTOM_FORM_TYPE,
        description: parsed.data.description,
        fields,
        isActive: true,
      },
    });
    templateId = template.id;
  }

  if (parsed.data.publishToSession) {
    const published = await prisma.form.create({
      data: {
        organizationId,
        sessionId: campSession.id,
        title: parsed.data.title,
        type: CUSTOM_FORM_TYPE,
        description: parsed.data.description,
        fields,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
        isActive: true,
      },
    });
    publishedId = published.id;
  }

  if (!templateId && !publishedId) {
    return NextResponse.json(
      { error: "Choose saveAsTemplate and/or publishToSession" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    id: publishedId ?? templateId,
    templateId,
    publishedId,
  });
}
