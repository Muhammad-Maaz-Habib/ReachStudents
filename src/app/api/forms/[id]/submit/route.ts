import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormFieldDefinition } from "@/lib/forms/templates";
import { formSubmissionSchema } from "@/lib/validations/forms";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: formId } = await context.params;
  const body = await request.json();
  const parsed = formSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const form = await prisma.form.findFirst({
    where: {
      id: formId,
      organizationId: session.user.organizationId,
      isActive: true,
    },
  });
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const student = await prisma.student.findFirst({
    where: {
      id: parsed.data.studentId,
      sessionId: form.sessionId ?? undefined,
      session: { organizationId: session.user.organizationId },
      ...(session.user.role === UserRole.PARENT
        ? { parents: { some: { userId: session.user.id } } }
        : {}),
    },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const fields = form.fields as FormFieldDefinition[];
  for (const field of fields) {
    if (!field.required || field.type === "signature") continue;
    const value = parsed.data.responses[field.id];
    if (value === undefined || value === "" || value === false) {
      return NextResponse.json(
        { error: `Missing required field: ${field.label}` },
        { status: 400 },
      );
    }
  }

  const submission = await prisma.formSubmission.upsert({
    where: {
      studentId_formId: {
        studentId: parsed.data.studentId,
        formId,
      },
    },
    update: {
      responses: parsed.data.responses,
      signatureData: { dataUrl: parsed.data.signatureDataUrl },
      signerName: parsed.data.signerName,
      signerEmail: parsed.data.signerEmail,
      submittedById: session.user.id,
      submittedAt: new Date(),
    },
    create: {
      studentId: parsed.data.studentId,
      formId,
      responses: parsed.data.responses,
      signatureData: { dataUrl: parsed.data.signatureDataUrl },
      signerName: parsed.data.signerName,
      signerEmail: parsed.data.signerEmail,
      submittedById: session.user.id,
    },
  });

  return NextResponse.json({
    id: submission.id,
    submittedAt: submission.submittedAt.toISOString(),
  });
}
