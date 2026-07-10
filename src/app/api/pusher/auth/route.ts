import { NextResponse } from "next/server";
import Pusher from "pusher";
import { auth } from "@/lib/auth";
import {
  chatChannelName,
  getNotificationConfig,
  isPusherEnabled,
  orgChannelName,
} from "@/lib/notifications/config";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPusherEnabled()) {
    return NextResponse.json({ error: "Realtime not configured" }, { status: 503 });
  }

  const form = await request.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channelName = String(form.get("channel_name") ?? "");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Invalid auth request" }, { status: 400 });
  }

  const orgChannel = orgChannelName(session.user.organizationId);
  const chatMatch = channelName.match(/^private-chat-(.+)$/);
  const isOrgChannel = channelName === orgChannel;
  const isChatChannel = !!chatMatch;

  if (!isOrgChannel && !isChatChannel) {
    return NextResponse.json({ error: "Forbidden channel" }, { status: 403 });
  }

  if (isChatChannel) {
    const channelId = chatMatch![1];
    const membership = await prisma.chatChannelMember.findUnique({
      where: {
        channelId_userId: { channelId, userId: session.user.id },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const config = getNotificationConfig();
  const pusher = new Pusher({
    appId: config.pusherAppId!,
    key: config.pusherKey!,
    secret: config.pusherSecret!,
    cluster: config.pusherCluster,
    useTLS: true,
  });

  const authResponse = pusher.authorizeChannel(socketId, channelName, {
    user_id: session.user.id,
    user_info: { name: session.user.name ?? session.user.email },
  });

  return new NextResponse(authResponse.auth);
}
