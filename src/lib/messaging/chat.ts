import { ChatChannelType, UserRole } from "@/generated/prisma/client";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

function generalChannelSlug(organizationId: string, sessionId: string) {
  return `${organizationId}-${sessionId}-general`;
}

function teamChannelSlug(organizationId: string, teamId: string) {
  return `${organizationId}-${teamId}-team`;
}

function mentorGroupChannelSlug(organizationId: string, mentorGroupId: string) {
  return `${organizationId}-${mentorGroupId}-mentor-group`;
}

function clubChannelSlug(organizationId: string, clubId: string) {
  return `${organizationId}-${clubId}-club`;
}

async function ensureMembers(channelId: string, userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  for (const userId of uniqueIds) {
    await prisma.chatChannelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: {},
      create: { channelId, userId },
    });
  }

  if (uniqueIds.length === 0) return;

  // Drop members who no longer belong (e.g. mentor reassigned).
  await prisma.chatChannelMember.deleteMany({
    where: {
      channelId,
      userId: { notIn: uniqueIds },
    },
  });
}

/**
 * Lazy upsert of default staff chat channels for the active session:
 * - GENERAL + TEAM: all active staff roles as members (existing behavior)
 * - MENTOR_GROUP: assigned mentor + session/super admins only
 * - CLUB: club advisors + session/super admins only
 */
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

  const [teams, mentorGroups, clubs, staffUsers] = await Promise.all([
    prisma.team.findMany({
      where: { sessionId },
      select: { id: true, name: true },
    }),
    prisma.mentorGroup.findMany({
      where: { sessionId },
      select: { id: true, name: true, mentorId: true },
    }),
    prisma.club.findMany({
      where: { sessionId },
      select: {
        id: true,
        name: true,
        advisors: { select: { userId: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { in: STAFF_ROLES },
      },
      select: { id: true, role: true },
    }),
  ]);

  const teamChannels = [];
  for (const team of teams) {
    teamChannels.push(
      await prisma.chatChannel.upsert({
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
    );
  }

  const mentorGroupChannels = [];
  for (const group of mentorGroups) {
    mentorGroupChannels.push(
      await prisma.chatChannel.upsert({
        where: { slug: mentorGroupChannelSlug(organizationId, group.id) },
        update: {
          name: group.name,
          mentorGroupId: group.id,
        },
        create: {
          organizationId,
          sessionId,
          mentorGroupId: group.id,
          type: ChatChannelType.MENTOR_GROUP,
          name: group.name,
          slug: mentorGroupChannelSlug(organizationId, group.id),
        },
      }),
    );
  }

  const clubChannels = [];
  for (const club of clubs) {
    clubChannels.push(
      await prisma.chatChannel.upsert({
        where: { slug: clubChannelSlug(organizationId, club.id) },
        update: {
          name: club.name,
          clubId: club.id,
        },
        create: {
          organizationId,
          sessionId,
          clubId: club.id,
          type: ChatChannelType.CLUB,
          name: club.name,
          slug: clubChannelSlug(organizationId, club.id),
        },
      }),
    );
  }

  const allStaffIds = staffUsers.map((user) => user.id);
  const adminIds = staffUsers
    .filter((user) => ADMIN_ROLES.includes(user.role))
    .map((user) => user.id);

  await ensureMembers(general.id, allStaffIds);
  for (const channel of teamChannels) {
    await ensureMembers(channel.id, allStaffIds);
  }
  for (let index = 0; index < mentorGroupChannels.length; index += 1) {
    const group = mentorGroups[index];
    const memberIds = [...new Set([group.mentorId, ...adminIds])];
    await ensureMembers(mentorGroupChannels[index].id, memberIds);
  }
  for (let index = 0; index < clubChannels.length; index += 1) {
    const club = clubs[index];
    const advisorIds = club.advisors.map((row) => row.userId);
    const memberIds = [...new Set([...advisorIds, ...adminIds])];
    await ensureMembers(clubChannels[index].id, memberIds);
  }

  return { general, teamChannels, mentorGroupChannels, clubChannels };
}

export async function listStaffChannels(userId: string, organizationId: string) {
  return prisma.chatChannel.findMany({
    where: {
      organizationId,
      members: { some: { userId } },
    },
    include: {
      team: { select: { name: true, color: true } },
      mentorGroup: { select: { name: true } },
      club: { select: { name: true } },
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
