import { sendEmail } from "@/lib/notifications/email";
import { getNotificationConfig } from "@/lib/notifications/config";
import { sendSms } from "@/lib/notifications/sms";
import { prisma } from "@/lib/prisma";

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function sendFormReminders(params: {
  formId: string;
  organizationId: string;
  organizationName: string;
  formTitle: string;
  studentIds?: string[];
}) {
  const form = await prisma.form.findFirst({
    where: { id: params.formId, organizationId: params.organizationId },
    include: {
      session: {
        include: {
          students: {
            where: params.studentIds?.length
              ? { id: { in: params.studentIds } }
              : undefined,
            select: {
              id: true,
              firstName: true,
              lastName: true,
              guardianEmail: true,
              guardianPhone: true,
            },
          },
        },
      },
    },
  });

  if (!form?.session) {
    return { sent: 0, skipped: 0 };
  }

  const config = getNotificationConfig();
  const cutoff = new Date(Date.now() - REMINDER_COOLDOWN_MS);
  let sent = 0;
  let skipped = 0;

  for (const student of form.session.students) {
    const existing = await prisma.formSubmission.findUnique({
      where: { studentId_formId: { studentId: student.id, formId: form.id } },
    });
    if (existing) continue;

    const recent = await prisma.formReminderDispatch.findFirst({
      where: {
        formId: form.id,
        studentId: student.id,
        dispatchedAt: { gte: cutoff },
      },
    });
    if (recent) {
      skipped += 1;
      continue;
    }

    const portalUrl = `${config.appUrl}/parent/forms?form=${form.id}&student=${student.id}`;
    const message = [
      `${params.organizationName}: Form reminder`,
      `"${params.formTitle}" for ${student.firstName} ${student.lastName} is still outstanding.`,
      `Complete: ${portalUrl}`,
    ].join("\n");

    const channels: string[] = [];
    if (student.guardianPhone) {
      const sms = await sendSms({ to: student.guardianPhone, body: message });
      if (sms.ok) channels.push("sms");
    }
    if (student.guardianEmail) {
      const email = await sendEmail({
        to: student.guardianEmail,
        subject: `Reminder: ${params.formTitle}`,
        text: message,
      });
      if (email.ok) channels.push("email");
    }

    if (channels.length > 0) {
      await prisma.formReminderDispatch.create({
        data: { formId: form.id, studentId: student.id, channels },
      });
      sent += 1;
    }
  }

  return { sent, skipped };
}
