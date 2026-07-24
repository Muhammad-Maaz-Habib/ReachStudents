import { Logo } from "@/components/branding/logo";
import { prisma } from "@/lib/prisma";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single-org deployments: brand the login page. Multi-org SaaS keeps Waypoint.
  const orgs = await prisma.organization.findMany({
    take: 2,
    select: {
      name: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const branding = orgs.length === 1 ? orgs[0] : null;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-orange-50 via-background to-emerald-50 dark:from-background dark:via-background dark:to-background">
      <header className="flex justify-center px-4 py-8">
        <Logo
          name={branding?.name}
          logoUrl={branding?.logoUrl}
          primaryColor={branding?.primaryColor}
          secondaryColor={branding?.secondaryColor}
        />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
