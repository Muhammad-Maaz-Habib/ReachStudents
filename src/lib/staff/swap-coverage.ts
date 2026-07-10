import { StaffCertificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type SwapCoverageResult =
  | { ok: true }
  | { ok: false; reason: string };

function isCertValid(
  certifications: { type: StaffCertificationType; expiresAt: Date | null }[],
  required: StaffCertificationType,
) {
  const now = new Date();
  return certifications.some(
    (cert) =>
      cert.type === required &&
      (!cert.expiresAt || cert.expiresAt.getTime() > now.getTime()),
  );
}

export async function validateSwapCoverage(
  requesterShiftId: string,
  targetShiftId: string,
): Promise<SwapCoverageResult> {
  const [requesterShift, targetShift] = await Promise.all([
    prisma.staffShift.findUnique({
      where: { id: requesterShiftId },
      include: {
        user: { include: { certifications: true } },
      },
    }),
    prisma.staffShift.findUnique({
      where: { id: targetShiftId },
      include: {
        user: { include: { certifications: true } },
      },
    }),
  ]);

  if (!requesterShift || !targetShift) {
    return { ok: false, reason: "Shift not found" };
  }

  // After swap: requester takes target shift, target user takes requester shift
  const newRequesterUser = targetShift.user;
  const newTargetUser = requesterShift.user;

  if (targetShift.requiredCertification) {
    if (
      !isCertValid(
        newRequesterUser.certifications,
        targetShift.requiredCertification,
      )
    ) {
      return {
        ok: false,
        reason: `${newRequesterUser.name ?? "Staff"} does not hold required ${targetShift.requiredCertification} certification for ${targetShift.dutyLabel}`,
      };
    }
  }

  if (requesterShift.requiredCertification) {
    if (
      !isCertValid(
        newTargetUser.certifications,
        requesterShift.requiredCertification,
      )
    ) {
      return {
        ok: false,
        reason: `${newTargetUser.name ?? "Staff"} does not hold required ${requesterShift.requiredCertification} certification for ${requesterShift.dutyLabel}`,
      };
    }
  }

  // Overlap check for swapped assignments on same day
  const sameDayShifts = await prisma.staffShift.findMany({
    where: {
      sessionId: requesterShift.sessionId,
      date: requesterShift.date,
      id: { notIn: [requesterShiftId, targetShiftId] },
    },
  });

  for (const shift of sameDayShifts) {
    if (shift.userId === newRequesterUser.id) {
      return {
        ok: false,
        reason: `${newRequesterUser.name ?? "Staff"} already has another duty that day`,
      };
    }
    if (shift.userId === newTargetUser.id) {
      return {
        ok: false,
        reason: `${newTargetUser.name ?? "Staff"} already has another duty that day`,
      };
    }
  }

  return { ok: true };
}

export async function executeShiftSwap(
  requesterShiftId: string,
  targetShiftId: string,
) {
  const [requesterShift, targetShift] = await Promise.all([
    prisma.staffShift.findUnique({ where: { id: requesterShiftId } }),
    prisma.staffShift.findUnique({ where: { id: targetShiftId } }),
  ]);

  if (!requesterShift || !targetShift) {
    throw new Error("Shift not found");
  }

  await prisma.$transaction([
    prisma.staffShift.update({
      where: { id: requesterShiftId },
      data: { userId: targetShift.userId },
    }),
    prisma.staffShift.update({
      where: { id: targetShiftId },
      data: { userId: requesterShift.userId },
    }),
  ]);
}
