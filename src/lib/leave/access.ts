import { ParentThreadTopic, UserRole } from "@/generated/prisma/client";
import { ADMIN_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/email";
import { sendSms } from "@/lib/notifications/sms";
import { getNotificationConfig } from "@/lib/notifications/config";
import { deliverParentMessage } from "@/lib/messaging/parent-delivery";

export async function canReviewLeaveRequest({
  userId,
  role,
  studentId,
}: {
  userId: string;
  role: UserRole;
  studentId: string;
}): Promise<boolean> {
  if (ADMIN_ROLES.includes(role)) return true;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { mentorGroup: { select: { mentorId: true } } },
  });
  return student?.mentorGroup?.mentorId === userId;
}

/** Notify student account + linked parents / guardian contacts of a leave decision. */
export async function notifyLeaveDecision(params: {
  organizationId: string;
  organizationName: string;
  studentId: string;
  studentName: string;
  status: "APPROVED" | "DENIED";
  startsAt: Date;
  endsAt: Date;
  reviewNote?: string | null;
  reviewerId: string;
  reviewerName: string;
}) {
  const config = getNotificationConfig();
  const windowLabel = `${params.startsAt.toLocaleString()} – ${params.endsAt.toLocaleString()}`;
  const decision = params.status === "APPROVED" ? "approved" : "denied";

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: {
      guardianEmail: true,
      guardianPhone: true,
      user: { select: { email: true, phone: true } },
      parents: {
        include: {
          user: { select: { email: true, phone: true, isActive: true } },
        },
      },
    },
  });
  if (!student) return;

  const subject = `Leave request ${decision} — ${params.studentName}`;
  const studentText = [
    `Your leave request was ${decision}.`,
    `Window: ${windowLabel}`,
    params.reviewNote?.trim()
      ? `Note from ${params.reviewerName}: ${params.reviewNote.trim()}`
      : null,
    "",
    `Details: ${config.appUrl}/student/leave`,
  ]
    .filter(Boolean)
    .join("\n");

  if (student.user?.email) {
    await sendEmail({ to: student.user.email, subject, text: studentText });
  }
  if (student.user?.phone) {
    await sendSms({
      to: student.user.phone,
      body: `${params.organizationName}: Leave ${decision} (${windowLabel}). ${config.appUrl}/student/leave`,
    });
  }

  const parentBody = [
    `Leave request for ${params.studentName} was ${decision} by ${params.reviewerName}.`,
    `Window: ${windowLabel}`,
    params.reviewNote?.trim() ? `Note: ${params.reviewNote.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const thread = await prisma.parentThread.create({
    data: {
      organizationId: params.organizationId,
      studentId: params.studentId,
      subject: `Leave ${decision}`,
      topic: ParentThreadTopic.GENERAL,
      messages: {
        create: {
          senderId: params.reviewerId,
          body: parentBody,
          sentVia: ["in_app"],
        },
      },
    },
  });

  const emails = new Set<string>();
  const phones = new Set<string>();
  if (student.guardianEmail) emails.add(student.guardianEmail.toLowerCase());
  if (student.guardianPhone) phones.add(student.guardianPhone);
  for (const link of student.parents) {
    if (!link.user.isActive) continue;
    if (link.user.email) emails.add(link.user.email.toLowerCase());
    if (link.user.phone) phones.add(link.user.phone);
  }

  for (const email of emails) {
    await deliverParentMessage({
      organizationId: params.organizationId,
      organizationName: params.organizationName,
      threadId: thread.id,
      studentName: params.studentName,
      senderName: params.reviewerName,
      body: parentBody,
      topic: ParentThreadTopic.GENERAL,
      guardianEmail: email,
      guardianPhone: null,
    });
  }
  for (const phone of phones) {
    await deliverParentMessage({
      organizationId: params.organizationId,
      organizationName: params.organizationName,
      threadId: thread.id,
      studentName: params.studentName,
      senderName: params.reviewerName,
      body: parentBody,
      topic: ParentThreadTopic.GENERAL,
      guardianEmail: null,
      guardianPhone: phone,
    });
  }
}
