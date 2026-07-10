import { prisma } from "@/lib/prisma";

const DEFAULT_WINDOW_DAYS = 14;

export async function getCertificationExpiryAlerts(
  organizationId: string,
  windowDays = DEFAULT_WINDOW_DAYS,
) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const certifications = await prisma.staffCertification.findMany({
    where: {
      user: { organizationId, isActive: true },
      expiresAt: { not: null },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { expiresAt: "asc" },
  });

  const expired: typeof certifications = [];
  const expiringSoon: typeof certifications = [];

  for (const cert of certifications) {
    if (!cert.expiresAt) continue;
    if (cert.expiresAt.getTime() < now.getTime()) {
      expired.push(cert);
    } else if (cert.expiresAt.getTime() <= windowEnd.getTime()) {
      expiringSoon.push(cert);
    }
  }

  return {
    windowDays,
    expired: expired.map(mapCert),
    expiringSoon: expiringSoon.map(mapCert),
    totalAlerts: expired.length + expiringSoon.length,
  };
}

function mapCert(cert: {
  id: string;
  type: string;
  label: string | null;
  expiresAt: Date | null;
  user: { id: string; name: string | null; email: string; role: string };
}) {
  return {
    id: cert.id,
    type: cert.type,
    label: cert.label,
    expiresAt: cert.expiresAt!.toISOString(),
    staff: {
      id: cert.user.id,
      name: cert.user.name,
      email: cert.user.email,
      role: cert.user.role,
    },
  };
}
