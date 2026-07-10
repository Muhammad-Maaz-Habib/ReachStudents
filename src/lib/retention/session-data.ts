import { SessionDataRetentionPolicy } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function applySessionDataRetention(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      sessionDataRetentionPolicy: true,
      sessionDataRetentionDaysAfterEnd: true,
    },
  });

  if (!organization || organization.sessionDataRetentionPolicy === SessionDataRetentionPolicy.NONE) {
    return { archived: 0, deleted: 0, skipped: true };
  }

  const cutoff = new Date(
    Date.now() - organization.sessionDataRetentionDaysAfterEnd * 24 * 60 * 60 * 1000,
  );

  const eligible = await prisma.campSession.findMany({
    where: {
      organizationId,
      endDate: { lt: cutoff },
      ...(organization.sessionDataRetentionPolicy === SessionDataRetentionPolicy.ARCHIVE
        ? { archivedAt: null }
        : {}),
    },
    select: { id: true, name: true },
  });

  if (organization.sessionDataRetentionPolicy === SessionDataRetentionPolicy.ARCHIVE) {
    const result = await prisma.campSession.updateMany({
      where: { id: { in: eligible.map((session) => session.id) } },
      data: { isActive: false, archivedAt: new Date() },
    });
    return { archived: result.count, deleted: 0, skipped: false };
  }

  let deleted = 0;
  for (const session of eligible) {
    await prisma.campSession.delete({ where: { id: session.id } });
    deleted += 1;
  }

  return { archived: 0, deleted, skipped: false };
}

export async function applySessionDataRetentionForAllOrgs() {
  const organizations = await prisma.organization.findMany({
    where: { sessionDataRetentionPolicy: { not: SessionDataRetentionPolicy.NONE } },
    select: { id: true },
  });

  let archived = 0;
  let deleted = 0;

  for (const organization of organizations) {
    const result = await applySessionDataRetention(organization.id);
    archived += result.archived;
    deleted += result.deleted;
  }

  return { organizations: organizations.length, archived, deleted };
}
