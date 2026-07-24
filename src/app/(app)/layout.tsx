import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/browser";
import { AppShell } from "@/components/layout/app-shell";
import { NAV_ITEMS } from "@/lib/constants";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === UserRole.PARENT) {
    redirect("/parent/dashboard");
  }

  if (session.user.role === UserRole.STUDENT) {
    redirect("/student/dashboard");
  }

  return (
    <AppShell navItems={NAV_ITEMS} user={session.user}>
      {children}
    </AppShell>
  );
}
