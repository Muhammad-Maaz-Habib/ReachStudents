import { UserRole } from "@/generated/prisma/client";
import { sendEmail } from "@/lib/notifications/email";
import { getNotificationConfig } from "@/lib/notifications/config";
import { pushOrgEvent } from "@/lib/notifications/pusher";
import { sendSms } from "@/lib/notifications/sms";
import { prisma } from "@/lib/prisma";
import { isSensitiveParentThread } from "@/lib/messaging/thread-delivery-shared";
import type { ParentThreadTopic } from "@/generated/prisma/client";

export async function deliverParentMessage(params: {
  organizationId: string;
  organizationName: string;
  threadId: string;
  studentName: string;
  senderName: string;
  body: string;
  topic: ParentThreadTopic;
  incidentId?: string | null;
  medicalProfileId?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
}) {
  const config = getNotificationConfig();
  const portalUrl = `${config.appUrl}/parent/messages?thread=${params.threadId}`;
  const sentVia: string[] = ["in_app"];
  const sensitive = isSensitiveParentThread(params);

  const smsBody = sensitive
    ? [
        `${params.organizationName}: New message from staff about ${params.studentName}.`,
        "View details in the app (message content not included in SMS).",
        portalUrl,
      ].join("\n")
    : [
        `${params.organizationName} — message about ${params.studentName}`,
        `${params.senderName}: ${params.body}`,
        `Reply in app: ${portalUrl}`,
      ].join("\n");

  const emailSubject = sensitive
    ? `New staff message — ${params.studentName} (${params.organizationName})`
    : `Message about ${params.studentName} — ${params.organizationName}`;

  const emailText = sensitive
    ? [
        `You have a new message from ${params.senderName} about ${params.studentName}.`,
        "For privacy, the message content is only available in the Waypoint parent portal.",
        "",
        `View message: ${portalUrl}`,
      ].join("\n")
    : [
        `${params.senderName} wrote:`,
        params.body,
        "",
        `View and reply: ${portalUrl}`,
      ].join("\n");

  if (params.guardianPhone) {
    const sms = await sendSms({ to: params.guardianPhone, body: smsBody });
    if (sms.ok) sentVia.push("sms");
  }

  if (params.guardianEmail) {
    const email = await sendEmail({
      to: params.guardianEmail,
      subject: emailSubject,
      text: emailText,
    });
    if (email.ok) sentVia.push("email");
  }

  return sentVia;
}

export async function notifyStaffOfParentMessage(params: {
  organizationId: string;
  studentId: string;
  studentName: string;
  senderName: string;
  body: string;
  threadId: string;
}) {
  await pushOrgEvent(params.organizationId, "parent-message", {
    threadId: params.threadId,
    studentName: params.studentName,
    senderName: params.senderName,
    preview: params.body.slice(0, 120),
  });

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: { teamId: true },
  });

  const admins = await prisma.user.findMany({
    where: {
      organizationId: params.organizationId,
      isActive: true,
      role: { in: [UserRole.SUPER_ADMIN, UserRole.SESSION_ADMIN] },
    },
    select: { email: true },
  });

  const teamStaff =
    student?.teamId != null
      ? await prisma.user.findMany({
          where: {
            organizationId: params.organizationId,
            isActive: true,
            teamAssignments: { some: { teamId: student.teamId } },
          },
          select: { email: true },
        })
      : [];

  const recipients = new Map(
    [...admins, ...teamStaff]
      .filter((user) => user.email)
      .map((user) => [user.email!, user.email!]),
  );

  for (const email of recipients.values()) {
    await sendEmail({
      to: email,
      subject: `Parent message about ${params.studentName}`,
      text: `${params.senderName}: ${params.body}`,
    });
  }
}
