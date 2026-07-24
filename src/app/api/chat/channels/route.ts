import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { hasPermission } from "@/lib/permissions";
import { PermissionResource } from "@/generated/prisma/browser";
import {
  ensureDefaultChatChannels,
  listStaffChannels,
} from "@/lib/messaging/chat";

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

  const campSession = await requireOrganizationSession(session.user.organizationId);
  await ensureDefaultChatChannels(session.user.organizationId, campSession.id);

  const channels = await listStaffChannels(
    session.user.id,
    session.user.organizationId,
  );

  return NextResponse.json({
    channels: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      teamColor: channel.team?.color ?? null,
      mentorGroupName: channel.mentorGroup?.name ?? null,
      messageCount: channel._count.messages,
      lastMessage: channel.messages[0]
        ? {
            body: channel.messages[0].body,
            senderName: channel.messages[0].sender.name,
            createdAt: channel.messages[0].createdAt.toISOString(),
          }
        : null,
    })),
  });
}
