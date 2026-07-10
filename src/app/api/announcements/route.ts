import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { announcementSchema } from "@/lib/validations/messaging";
import { sendEmail } from "@/lib/notifications/email";
import { sendSms } from "@/lib/notifications/sms";
import { UserRole } from "@/generated/prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.MESSAGING,
    "view",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const announcements = await prisma.announcement.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      sender: { select: { name: true } },
      team: { select: { name: true } },
      session: { select: { name: true } },
      reads: {
        where: { userId: session.user.id },
        select: { readAt: true },
      },
      _count: { select: { reads: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    announcements: announcements.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      channels: item.channels,
      createdAt: item.createdAt.toISOString(),
      senderName: item.sender.name,
      scope: item.team?.name ?? item.session?.name ?? "Organization-wide",
      readAt: item.reads[0]?.readAt?.toISOString() ?? null,
      readCount: item._count.reads,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasPermission(
    session.user.organizationId,
    session.user.role,
    PermissionResource.MESSAGING,
    "edit",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campSession = await requireOrganizationSession(session.user.organizationId);

  const announcement = await prisma.announcement.create({
    data: {
      organizationId: session.user.organizationId,
      sessionId: parsed.data.sessionId ?? campSession.id,
      teamId: parsed.data.teamId,
      senderId: session.user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      channels: parsed.data.channels,
    },
  });

  if (parsed.data.channels.includes("email") || parsed.data.channels.includes("sms")) {
    const recipients = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
        role: { not: UserRole.STUDENT },
      },
      select: { email: true, phone: true },
    });

    for (const recipient of recipients) {
      if (parsed.data.channels.includes("email") && recipient.email) {
        await sendEmail({
          to: recipient.email,
          subject: announcement.title,
          text: announcement.body,
        });
      }
      if (parsed.data.channels.includes("sms") && recipient.phone) {
        await sendSms({
          to: recipient.phone,
          body: `${announcement.title}\n${announcement.body}`,
        });
      }
    }
  }

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      createdAt: announcement.createdAt.toISOString(),
    },
  });
}
