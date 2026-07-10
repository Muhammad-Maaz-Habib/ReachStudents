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
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  QrCode,
  Settings,
  Siren,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
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

type MobileNavProps = {
  items: readonly NavItem[];
};

export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {items.slice(0, 5).map((item) => {
          const Icon = iconMap[item.icon] ?? LayoutDashboard;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
