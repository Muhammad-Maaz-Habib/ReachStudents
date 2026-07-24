"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  FileText,
  HeartPulse,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  QrCode,
  Settings,
  Siren,
  UserCog,
  Users,
  UsersRound,
  Landmark,
  Bus,
  ClipboardList,
} from "lucide-react";
import { Logo } from "@/components/branding/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/generated/prisma/browser";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  UsersRound,
  Landmark,
  Bus,
  ClipboardList,
  QrCode,
  Calendar,
  MessageSquare,
  Megaphone,
  HeartPulse,
  AlertTriangle,
  FileText,
  UserCog,
  BarChart3,
  Siren,
  Settings,
  Home,
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type AppSidebarProps = {
  items: readonly NavItem[];
  user: {
    name?: string | null;
    email?: string | null;
    role: UserRole;
    organizationName?: string | null;
    organizationLogoUrl?: string | null;
    organizationPrimaryColor?: string | null;
    organizationSecondaryColor?: string | null;
  };
  onSignOut: () => void;
};

export function AppSidebar({ items, user, onSignOut }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center border-b px-5">
        <Logo
          size="sm"
          name={user.organizationName}
          logoUrl={user.organizationLogoUrl}
          primaryColor={user.organizationPrimaryColor}
          secondaryColor={user.organizationSecondaryColor}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1" aria-label="Sidebar">
          {items.map((item) => {
            const Icon = iconMap[item.icon] ?? LayoutDashboard;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t p-4">
        <div className="mb-3 px-1">
          <p className="truncate text-sm font-medium">{user.name ?? "User"}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
        <Separator className="mb-3" />
        <div className="space-y-2">
          <Link
            href="/account"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full justify-start",
            )}
          >
            <KeyRound className="size-4" aria-hidden />
            Change password
          </Link>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onSignOut}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}
