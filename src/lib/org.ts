import { prisma } from "@/lib/prisma";

export async function getOrganizationSession(organizationId: string) {
  return prisma.campSession.findFirst({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: { startDate: "desc" },
    include: {
      teams: {
        orderBy: { name: "asc" },
        include: {
          staff: {
            include: {
              user: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
      mentorGroups: {
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });
}

export async function requireOrganizationSession(organizationId: string) {
  const session = await getOrganizationSession(organizationId);
  if (!session) {
    throw new Error("No active camp session found for this organization");
  }
  return session;
}
