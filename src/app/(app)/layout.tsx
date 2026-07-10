import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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

  return (
    <AppShell navItems={NAV_ITEMS} user={session.user}>
      {children}
    </AppShell>
  );
}
