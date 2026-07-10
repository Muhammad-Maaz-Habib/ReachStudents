import { NextResponse } from "next/server";
import { ShiftSwapStatus } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES } from "@/lib/constants";
import {
  executeShiftSwap,
  validateSwapCoverage,
} from "@/lib/staff/swap-coverage";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const action = body.action as "accept" | "approve" | "reject" | "cancel";

  const swap = await prisma.shiftSwapRequest.findFirst({
    where: {
      id,
      session: { organizationId: session.user.organizationId },
    },
    include: {
      requesterShift: true,
      targetShift: true,
    },
  });

  if (!swap) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "cancel") {
    if (swap.requestedById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.shiftSwapRequest.update({
      where: { id },
      data: { status: ShiftSwapStatus.CANCELLED },
    });
    return NextResponse.json({ status: ShiftSwapStatus.CANCELLED });
  }

  if (action === "accept") {
    if (swap.targetShift.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (swap.status !== ShiftSwapStatus.PENDING_ACCEPTANCE) {
      return NextResponse.json({ error: "Swap is not pending acceptance" }, { status: 400 });
    }

    const coverage = await validateSwapCoverage(
      swap.requesterShiftId,
      swap.targetShiftId,
    );

    if (coverage.ok) {
      await executeShiftSwap(swap.requesterShiftId, swap.targetShiftId);
      await prisma.shiftSwapRequest.update({
        where: { id },
        data: {
          status: ShiftSwapStatus.APPROVED,
          targetAcceptedAt: new Date(),
        },
      });
      return NextResponse.json({
        status: ShiftSwapStatus.APPROVED,
        message: "Swap completed — both parties confirmed and coverage checks passed",
      });
    }

    await prisma.shiftSwapRequest.update({
      where: { id },
      data: {
        status: ShiftSwapStatus.PENDING_ADMIN,
        targetAcceptedAt: new Date(),
        coverageIssue: coverage.reason,
      },
    });
    return NextResponse.json({
      status: ShiftSwapStatus.PENDING_ADMIN,
      message: "Both confirmed, but admin approval required due to coverage gap",
      coverageIssue: coverage.reason,
    });
  }

  if (action === "approve" || action === "reject") {
    if (!ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (swap.status !== ShiftSwapStatus.PENDING_ADMIN) {
      return NextResponse.json({ error: "Swap is not pending admin review" }, { status: 400 });
    }

    if (action === "reject") {
      await prisma.shiftSwapRequest.update({
        where: { id },
        data: {
          status: ShiftSwapStatus.REJECTED,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({ status: ShiftSwapStatus.REJECTED });
    }

    await executeShiftSwap(swap.requesterShiftId, swap.targetShiftId);
    await prisma.shiftSwapRequest.update({
      where: { id },
      data: {
        status: ShiftSwapStatus.APPROVED,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({ status: ShiftSwapStatus.APPROVED });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
