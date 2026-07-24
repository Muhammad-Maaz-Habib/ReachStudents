import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type ProvisionStudentLoginResult = {
  action: "created" | "linked" | "relinked";
  userId: string;
  email: string;
  temporaryPassword?: string;
};

function generateTemporaryPassword() {
  return `CampTemp-${randomBytes(4).toString("hex")}`;
}

/**
 * Create or link a STUDENT User for a roster Student in this session.
 * Reuses an existing org STUDENT user by email when present.
 */
export async function provisionStudentLogin({
  organizationId,
  studentId,
  email: emailRaw,
  resetPassword = false,
}: {
  organizationId: string;
  studentId: string;
  email: string;
  /** When linking an existing inactive/active student user, optionally issue a new temp password. */
  resetPassword?: boolean;
}): Promise<ProvisionStudentLoginResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Invalid email "${emailRaw}"`);
  }

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      session: { organizationId },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userId: true,
      sessionId: true,
    },
  });
  if (!student) {
    throw new Error("Student not found");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    if (
      existingUser.organizationId &&
      existingUser.organizationId !== organizationId
    ) {
      throw new Error(`Email "${email}" belongs to another organization`);
    }

    if (existingUser.role !== UserRole.STUDENT) {
      throw new Error(
        `Email "${email}" is already used by a ${existingUser.role.replaceAll("_", " ").toLowerCase()} account`,
      );
    }

    const conflict = await prisma.student.findFirst({
      where: {
        sessionId: student.sessionId,
        userId: existingUser.id,
        id: { not: student.id },
      },
      select: { id: true, firstName: true, lastName: true },
    });
    if (conflict) {
      throw new Error(
        `That login is already linked to ${conflict.firstName} ${conflict.lastName} in this session`,
      );
    }

    let temporaryPassword: string | undefined;
    if (resetPassword || !existingUser.passwordHash) {
      temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          organizationId,
          name: `${student.firstName} ${student.lastName}`.trim(),
          passwordHash,
          mustChangePassword: true,
          isActive: true,
          role: UserRole.STUDENT,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          organizationId,
          name: `${student.firstName} ${student.lastName}`.trim(),
          isActive: true,
          role: UserRole.STUDENT,
        },
      });
    }

    await prisma.student.update({
      where: { id: student.id },
      data: { userId: existingUser.id },
    });

    return {
      action: student.userId === existingUser.id ? "relinked" : "linked",
      userId: existingUser.id,
      email,
      temporaryPassword,
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const displayName = `${student.firstName} ${student.lastName}`.trim();

  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      name: displayName,
      role: UserRole.STUDENT,
      passwordHash,
      mustChangePassword: true,
      isActive: true,
    },
  });

  await prisma.student.update({
    where: { id: student.id },
    data: { userId: user.id },
  });

  return {
    action: "created",
    userId: user.id,
    email,
    temporaryPassword,
  };
}

export async function resetStudentLoginPassword({
  organizationId,
  studentId,
}: {
  organizationId: string;
  studentId: string;
}): Promise<{ email: string; temporaryPassword: string }> {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      session: { organizationId },
      userId: { not: null },
    },
    include: {
      user: { select: { id: true, email: true, role: true } },
    },
  });
  if (!student?.user || student.user.role !== UserRole.STUDENT) {
    throw new Error("Student does not have a login yet");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  await prisma.user.update({
    where: { id: student.user.id },
    data: {
      passwordHash,
      mustChangePassword: true,
      isActive: true,
    },
  });

  return { email: student.user.email, temporaryPassword };
}

export async function unlinkStudentLogin({
  organizationId,
  studentId,
}: {
  organizationId: string;
  studentId: string;
}) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      session: { organizationId },
    },
    select: { id: true, userId: true },
  });
  if (!student) {
    throw new Error("Student not found");
  }
  if (!student.userId) {
    return;
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { userId: null },
  });
}

/** Resolve the active-session Student row for a STUDENT User. */
export async function getLinkedStudentForUser(
  userId: string,
  organizationId: string,
) {
  const activeSession = await prisma.campSession.findFirst({
    where: { organizationId, isActive: true },
    select: { id: true },
    orderBy: { startDate: "desc" },
  });
  if (!activeSession) return null;

  return prisma.student.findFirst({
    where: {
      userId,
      sessionId: activeSession.id,
    },
    include: {
      team: { select: { id: true, name: true } },
      mentorGroup: {
        select: {
          id: true,
          name: true,
          mentor: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}
