import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { chatMessageSchema } from "@/lib/validations/messaging";
import { pushChatEvent } from "@/lib/notifications/pusher";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
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

  const { id } = await context.params;

  const membership = await prisma.chatChannelMember.findUnique({
    where: {
      channelId_userId: { channelId: id, userId: session.user.id },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { channelId: id },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  await prisma.chatChannelMember.update({
    where: {
      channelId_userId: { channelId: id, userId: session.user.id },
    },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        isSelf: message.sender.id === session.user.id,
      },
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const body = await request.json();
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const membership = await prisma.chatChannelMember.findUnique({
    where: {
      channelId_userId: { channelId: id, userId: session.user.id },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const message = await prisma.chatMessage.create({
    data: {
      channelId: id,
      senderId: session.user.id,
      body: parsed.data.body,
    },
    include: { sender: { select: { id: true, name: true } } },
  });

  const payload = {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    sender: {
      id: message.sender.id,
      name: message.sender.name,
      isSelf: false,
    },
  };

  await pushChatEvent(id, "new-message", payload);

  return NextResponse.json({
    message: {
      ...payload,
      sender: { ...payload.sender, isSelf: true },
    },
  });
}
