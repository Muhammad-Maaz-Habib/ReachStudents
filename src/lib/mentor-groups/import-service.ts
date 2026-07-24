import { STAFF_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { MentorGroupCsvRow } from "@/lib/csv/mentor-group-import";

export type ImportMentorGroupResult = {
  group: { id: string; name: string; mentorId: string };
  action: "created" | "updated";
};

/**
 * Create or update a mentor group by name within a session.
 * Matches mentor by email among active staff. Does not change student roster.
 */
export async function importMentorGroupRecord({
  organizationId,
  sessionId,
  data,
}: {
  organizationId: string;
  sessionId: string;
  data: MentorGroupCsvRow;
}): Promise<ImportMentorGroupResult> {
  const name = data.name.trim();
  const mentorEmail = data.mentor_email.trim().toLowerCase();

  if (!name) {
    throw new Error("name is required");
  }
  if (!mentorEmail) {
    throw new Error("mentor_email is required");
  }

  const mentor = await prisma.user.findFirst({
    where: {
      organizationId,
      email: { equals: mentorEmail, mode: "insensitive" },
      isActive: true,
      role: { in: STAFF_ROLES },
    },
    select: { id: true, email: true },
  });

  if (!mentor) {
    throw new Error(
      `No active staff account found for mentor_email "${data.mentor_email}"`,
    );
  }

  const existing = await prisma.mentorGroup.findFirst({
    where: {
      sessionId,
      name: { equals: name, mode: "insensitive" },
    },
  });

  if (existing) {
    const updated = await prisma.mentorGroup.update({
      where: { id: existing.id },
      data: {
        name,
        mentorId: mentor.id,
      },
      select: { id: true, name: true, mentorId: true },
    });
    return { group: updated, action: "updated" };
  }

  const created = await prisma.mentorGroup.create({
    data: {
      sessionId,
      name,
      mentorId: mentor.id,
    },
    select: { id: true, name: true, mentorId: true },
  });

  return { group: created, action: "created" };
}
