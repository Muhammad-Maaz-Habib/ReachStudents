import { NextResponse } from "next/server";
import { ShiftSwapStatus } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/constants";
import {
  executeShiftSwap,
  validateSwapCoverage,
} from "@/lib/staff/swap-coverage";
import { shiftSwapSchema } from "@/lib/validations/staff";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const swaps = await prisma.shiftSwapRequest.findMany({
    where: { sessionId: campSession.id },
    include: {
      requesterShift: {
        include: { user: { select: { name: true } } },
      },
      targetShift: {
        include: { user: { select: { name: true } } },
      },
      requestedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    swaps: swaps.map((swap) => ({
      id: swap.id,
      status: swap.status,
      coverageIssue: swap.coverageIssue,
      createdAt: swap.createdAt.toISOString(),
      requestedByName: swap.requestedBy.name,
      requesterShift: {
        id: swap.requesterShift.id,
        dutyLabel: swap.requesterShift.dutyLabel,
        date: swap.requesterShift.date.toISOString().slice(0, 10),
        userName: swap.requesterShift.user.name,
        userId: swap.requesterShift.userId,
      },
      targetShift: {
        id: swap.targetShift.id,
        dutyLabel: swap.targetShift.dutyLabel,
        date: swap.targetShift.date.toISOString().slice(0, 10),
        userName: swap.targetShift.user.name,
        userId: swap.targetShift.userId,
      },
      canAccept:
        swap.status === ShiftSwapStatus.PENDING_ACCEPTANCE &&
        swap.targetShift.userId === session.user.id,
      isRequester: swap.requestedById === session.user.id,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = shiftSwapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const [requesterShift, targetShift] = await Promise.all([
    prisma.staffShift.findFirst({
      where: {
        id: parsed.data.requesterShiftId,
        sessionId: campSession.id,
      },
    }),
    prisma.staffShift.findFirst({
      where: {
        id: parsed.data.targetShiftId,
        sessionId: campSession.id,
      },
    }),
  ]);

  if (!requesterShift || !targetShift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  if (requesterShift.userId !== session.user.id) {
    return NextResponse.json(
      { error: "You can only request swaps for your own shifts" },
      { status: 403 },
    );
  }

  if (targetShift.userId === session.user.id) {
    return NextResponse.json(
      { error: "Pick a different staff member's shift to swap with" },
      { status: 400 },
    );
  }

  const swap = await prisma.shiftSwapRequest.create({
    data: {
      sessionId: campSession.id,
      requesterShiftId: requesterShift.id,
      targetShiftId: targetShift.id,
      requestedById: session.user.id,
      requesterAcceptedAt: new Date(),
      status: ShiftSwapStatus.PENDING_ACCEPTANCE,
    },
  });

  return NextResponse.json({ id: swap.id });
}
