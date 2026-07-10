import { UserRole } from "@/generated/prisma/client";
import { getMissingStudentAlerts } from "@/lib/alerts/missing-students";
import { sendEmail } from "@/lib/notifications/email";
import { pushOrgEvent } from "@/lib/notifications/pusher";
import { sendSms } from "@/lib/notifications/sms";
import { prisma } from "@/lib/prisma";

const DISPATCH_COOLDOWN_MS = 30 * 60 * 1000;

export type MissingAlertEscalationLevel = "initial" | "reminder" | "admin";

function resolveEscalationLevel(
  overdueMinutes: number,
  thresholdMinutes: number,
): MissingAlertEscalationLevel | null {
  if (overdueMinutes >= 60) return "admin";
  if (overdueMinutes >= 30) return "reminder";
  if (overdueMinutes >= thresholdMinutes) return "initial";
  return null;
}

async function getRecipientsForLevel(
  organizationId: string,
  teamIds: string[],
  level: MissingAlertEscalationLevel,
) {
  const select = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
  } as const;

  const baseWhere = {
    organizationId,
    isActive: true,
  };

  if (level === "admin") {
    return prisma.user.findMany({
      where: {
        ...baseWhere,
        role: { in: [UserRole.SUPER_ADMIN, UserRole.SESSION_ADMIN] },
      },
      select,
    });
  }

  const staffRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.SESSION_ADMIN,
    UserRole.STAFF,
    UserRole.NURSE,
  ];

  if (teamIds.length === 0) {
    return prisma.user.findMany({
      where: { ...baseWhere, role: { in: staffRoles } },
      select,
    });
  }

  const [admins, teamStaff] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...baseWhere,
        role: { in: [UserRole.SUPER_ADMIN, UserRole.SESSION_ADMIN] },
      },
      select,
    }),
    prisma.user.findMany({
      where: {
        ...baseWhere,
        role: { in: staffRoles },
        teamAssignments: { some: { teamId: { in: teamIds } } },
      },
      select,
    }),
  ]);

  return [...new Map([...admins, ...teamStaff].map((user) => [user.id, user])).values()];
}

function buildAlertMessage(
  alert: {
    activityName: string;
    location: string | null;
    overdueMinutes: number;
    students: { firstName: string; lastName: string }[];
  },
  level: MissingAlertEscalationLevel,
) {
  const studentList = alert.students
    .map((student) => `${student.firstName} ${student.lastName}`)
    .join(", ");

  const prefix =
    level === "admin"
      ? "ESCALATION — SESSION ADMIN"
      : level === "reminder"
        ? "URGENT — STILL MISSING"
        : "MISSING CHECK-IN";

  return [
    `${prefix}: ${alert.activityName}`,
    alert.location ? `Location: ${alert.location}` : null,
    `${alert.students.length} student(s) not checked in (${alert.overdueMinutes} min past start)`,
    studentList,
    level === "admin"
      ? "Students still unresolved after 60 minutes — immediate follow-up required."
      : level === "reminder"
        ? "Still unresolved 30+ minutes after activity start."
        : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function dispatchMissingStudentAlerts(
  organizationId: string,
  sessionId: string,
) {
  const alerts = await getMissingStudentAlerts(sessionId);
  if (alerts.length === 0) {
    return { dispatched: 0, skipped: 0 };
  }

  const cutoff = new Date(Date.now() - DISPATCH_COOLDOWN_MS);
  let dispatched = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const level = resolveEscalationLevel(
      alert.overdueMinutes,
      alert.thresholdMinutes,
    );
    if (!level) continue;

    const recent = await prisma.missingAlertDispatch.findFirst({
      where: {
        activityId: alert.activityId,
        escalationLevel: level,
        dispatchedAt: { gte: cutoff },
      },
    });
    if (recent) {
      skipped += 1;
      continue;
    }

    const activity = await prisma.activity.findUnique({
      where: { id: alert.activityId },
      select: { teamId: true },
    });

    const teamIds = activity?.teamId ? [activity.teamId] : [];
    const recipients = await getRecipientsForLevel(
      organizationId,
      teamIds,
      level,
    );

    const message = buildAlertMessage(alert, level);
    const channels: string[] = [];
    let recipientCount = 0;

    const emailSubject =
      level === "admin"
        ? `[ESCALATION] Missing check-in: ${alert.activityName}`
        : level === "reminder"
          ? `[URGENT] Missing check-in: ${alert.activityName}`
          : `Missing check-in: ${alert.activityName}`;

    for (const recipient of recipients) {
      recipientCount += 1;
      if (recipient.phone) {
        const sms = await sendSms({ to: recipient.phone, body: message });
        if (sms.ok && !channels.includes("sms")) channels.push("sms");
      }
      if (recipient.email) {
        const email = await sendEmail({
          to: recipient.email,
          subject: emailSubject,
          text: message,
        });
        if (email.ok && !channels.includes("email")) channels.push("email");
      }
    }

    await pushOrgEvent(organizationId, "missing-student-alert", {
      activityId: alert.activityId,
      activityName: alert.activityName,
      missingCount: alert.students.length,
      escalationLevel: level,
      students: alert.students,
    });
    if (!channels.includes("push")) channels.push("push");

    await prisma.missingAlertDispatch.create({
      data: {
        activityId: alert.activityId,
        escalationLevel: level,
        recipientCount,
        channels,
      },
    });

    dispatched += 1;
  }

  return { dispatched, skipped };
}
