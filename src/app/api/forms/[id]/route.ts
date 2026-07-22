import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { AUDIT_RESOURCES, logAudit } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Archives (unpublishes) a form or custom template.
 * Submissions and signatures are preserved — the form is only hidden from
 * parents/staff lists (isActive=false). Hard-delete would cascade-wipe
 * submissions via the schema relation, which we avoid for compliance.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const form = await prisma.form.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
      isActive: true,
    },
    include: { _count: { select: { submissions: true } } },
  });

  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const isTemplate = form.sessionId === null;

  await prisma.form.update({
    where: { id: form.id },
    data: { isActive: false },
  });

  logAudit({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    resource: AUDIT_RESOURCES.SETTINGS,
    action: "delete",
    targetRecord: form.id,
    metadata: {
      area: isTemplate ? "form_template_archive" : "form_unpublish",
      title: form.title,
      type: form.type,
      sessionId: form.sessionId,
      submissionsPreserved: form._count.submissions,
    },
  });

  return NextResponse.json({
    ok: true,
    mode: "archived",
    isTemplate,
    submissionsPreserved: form._count.submissions,
    message: isTemplate
      ? "Custom template archived. Published session copies are unchanged."
      : "Form unpublished. Existing submissions and signatures were kept.",
  });
}
