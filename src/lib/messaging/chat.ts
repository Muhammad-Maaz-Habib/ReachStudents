import { ChatChannelType, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function generalChannelSlug(organizationId: string, sessionId: string) {
  return `${organizationId}-${sessionId}-general`;
}

function teamChannelSlug(organizationId: string, teamId: string) {
  return `${organizationId}-${teamId}-team`;
}

export async function ensureDefaultChatChannels(
  organizationId: string,
  sessionId: string,
) {
  const general = await prisma.chatChannel.upsert({
    where: { slug: generalChannelSlug(organizationId, sessionId) },
    update: {},
    create: {
      organizationId,
      sessionId,
      type: ChatChannelType.GENERAL,
      name: "All staff",
      slug: generalChannelSlug(organizationId, sessionId),
    },
  });

  const teams = await prisma.team.findMany({
    where: { sessionId },
    select: { id: true, name: true },
  });

  const teamChannels = await Promise.all(
    teams.map((team) =>
      prisma.chatChannel.upsert({
        where: { slug: teamChannelSlug(organizationId, team.id) },
        update: { name: team.name },
        create: {
          organizationId,
          sessionId,
          teamId: team.id,
          type: ChatChannelType.TEAM,
          name: team.name,
          slug: teamChannelSlug(organizationId, team.id),
        },
      }),
    ),
  );

  const staffUsers = await prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      role: {
        in: [
          UserRole.SUPER_ADMIN,
          UserRole.SESSION_ADMIN,
          UserRole.STAFF,
          UserRole.NURSE,
        ],
      },
    },
    select: { id: true },
  });

  const channelIds = [general.id, ...teamChannels.map((channel) => channel.id)];

  await Promise.all(
    channelIds.flatMap((channelId) =>
      staffUsers.map((user) =>
        prisma.chatChannelMember.upsert({
          where: { channelId_userId: { channelId, userId: user.id } },
          update: {},
          create: { channelId, userId: user.id },
        }),
      ),
    ),
  );

  return { general, teamChannels };
}

export async function listStaffChannels(userId: string, organizationId: string) {
  return prisma.chatChannel.findMany({
    where: {
      organizationId,
      members: { some: { userId } },
    },
    include: {
      team: { select: { name: true, color: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { name: true } } },
      },
      _count: { select: { messages: true } },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}
