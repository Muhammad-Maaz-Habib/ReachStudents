import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { PARENT_NAV_ITEMS } from "@/lib/constants";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell navItems={PARENT_NAV_ITEMS} user={session.user}>
      {children}
    </AppShell>
  );
}
