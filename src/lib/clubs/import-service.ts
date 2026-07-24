import { STAFF_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  parseAdvisorEmails,
  type ClubCsvRow,
} from "@/lib/csv/club-import";

export type ImportClubResult = {
  club: { id: string; name: string };
  action: "created" | "updated";
};

/**
 * Create or update a club by name. Sets advisors from emails (1–3).
 * Does not change student memberships.
 */
export async function importClubRecord({
  organizationId,
  sessionId,
  data,
}: {
  organizationId: string;
  sessionId: string;
  data: ClubCsvRow;
}): Promise<ImportClubResult> {
  const name = data.name.trim();
  const emails = parseAdvisorEmails(data.advisor_emails);

  if (!name) throw new Error("name is required");
  if (emails.length === 0) throw new Error("advisor_emails is required");
  if (emails.length > 3) throw new Error("at most 3 advisor emails allowed");

  const advisors = await prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      role: { in: STAFF_ROLES },
      OR: emails.map((email) => ({
        email: { equals: email, mode: "insensitive" as const },
      })),
    },
    select: { id: true, email: true },
  });

  if (advisors.length !== emails.length) {
    const found = new Set(advisors.map((row) => row.email.toLowerCase()));
    const missing = emails.filter((email) => !found.has(email));
    throw new Error(
      `No active staff for advisor email(s): ${missing.join(", ")}`,
    );
  }

  const existing = await prisma.club.findFirst({
    where: {
      sessionId,
      name: { equals: name, mode: "insensitive" },
    },
  });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.club.update({
        where: { id: existing.id },
        data: { name },
      });
      await tx.clubAdvisor.deleteMany({ where: { clubId: existing.id } });
      await tx.clubAdvisor.createMany({
        data: advisors.map((advisor) => ({
          clubId: existing.id,
          userId: advisor.id,
        })),
      });
    });
    return {
      club: { id: existing.id, name },
      action: "updated",
    };
  }

  const created = await prisma.club.create({
    data: {
      sessionId,
      name,
      advisors: {
        create: advisors.map((advisor) => ({ userId: advisor.id })),
      },
    },
    select: { id: true, name: true },
  });

  return { club: created, action: "created" };
}
