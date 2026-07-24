"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AppSidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { UserRole } from "@/generated/prisma/browser";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type AppShellProps = {
  children: React.ReactNode;
  navItems: readonly NavItem[];
  user: {
    name?: string | null;
    email?: string | null;
    role: UserRole;
    organizationName?: string | null;
    organizationLogoUrl?: string | null;
    organizationPrimaryColor?: string | null;
    organizationSecondaryColor?: string | null;
  };
};

export function AppShell({ children, navItems, user }: AppShellProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar items={navItems} user={user} onSignOut={handleSignOut} />
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        <MobileNav items={navItems} />
      </div>
    </div>
  );
}
