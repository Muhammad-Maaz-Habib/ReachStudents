import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormFieldDefinition } from "@/lib/forms/templates";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== UserRole.PARENT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const formId = searchParams.get("form");

  const links = await prisma.studentParent.findMany({
    where: {
      userId: session.user.id,
      student: { session: { organizationId: session.user.organizationId } },
    },
    select: {
      student: {
        select: { id: true, firstName: true, lastName: true, sessionId: true },
      },
    },
  });

  const studentIds = links.map((link) => link.student.id);
  if (studentIds.length === 0) {
    return NextResponse.json({ pending: [], completed: [] });
  }

  const filterStudentId = searchParams.get("student");

  const forms = await prisma.form.findMany({
    where: {
      organizationId: session.user.organizationId,
      sessionId: links[0].student.sessionId,
      isActive: true,
      ...(formId ? { id: formId } : {}),
    },
    include: {
      submissions: {
        where: { studentId: { in: studentIds } },
        select: { studentId: true, submittedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending: {
    formId: string;
    studentId: string;
    studentName: string;
    title: string;
    type: string;
    fields: FormFieldDefinition[];
    deadline: string | null;
  }[] = [];

  const completed: {
    formId: string;
    studentId: string;
    studentName: string;
    title: string;
    submittedAt: string;
  }[] = [];

  for (const form of forms) {
    for (const link of links) {
      if (filterStudentId && link.student.id !== filterStudentId) continue;
      const submission = form.submissions.find(
        (item) => item.studentId === link.student.id,
      );
      const studentName = `${link.student.firstName} ${link.student.lastName}`;
      if (submission) {
        completed.push({
          formId: form.id,
          studentId: link.student.id,
          studentName,
          title: form.title,
          submittedAt: submission.submittedAt.toISOString(),
        });
      } else {
        pending.push({
          formId: form.id,
          studentId: link.student.id,
          studentName,
          title: form.title,
          type: form.type,
          fields: form.fields as FormFieldDefinition[],
          deadline: form.deadline?.toISOString() ?? null,
        });
      }
    }
  }

  return NextResponse.json({ pending, completed });
}
