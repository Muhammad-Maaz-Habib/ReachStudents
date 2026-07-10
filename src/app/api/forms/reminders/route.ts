import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { sendFormReminders } from "@/lib/forms/reminders";
import { formReminderSchema } from "@/lib/validations/forms";

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
  const parsed = formReminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const form = await prisma.form.findFirst({
    where: {
      id: parsed.data.formId,
      organizationId: session.user.organizationId,
    },
    include: { organization: { select: { name: true } } },
  });
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const result = await sendFormReminders({
    formId: form.id,
    organizationId: session.user.organizationId,
    organizationName: form.organization.name,
    formTitle: form.title,
    studentIds: parsed.data.studentIds,
  });

  return NextResponse.json(result);
}
