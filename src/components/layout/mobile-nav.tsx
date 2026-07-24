"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Ellipsis,
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
  UsersRound,
  Landmark,
  Bus,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getMobileNavLayout } from "@/lib/navigation/mobile-nav";
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

type MobileNavProps = {
  items: readonly NavItem[];
  role: UserRole;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ items, role }: MobileNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const layout = getMobileNavLayout(role, items);
  const hasMore = layout.moreGroups.length > 0;

  const moreHrefs = layout.moreGroups.flatMap((g) => g.items.map((i) => i.href));
  const moreSectionActive = moreHrefs.some((href) => isActivePath(pathname, href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
          {layout.primary.map((item) => {
            const Icon = iconMap[item.icon] ?? LayoutDashboard;
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}

          {hasMore ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[11px] font-medium transition-colors",
                moreOpen || moreSectionActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-expanded={moreOpen}
              aria-controls="mobile-more-sheet"
            >
              <Ellipsis className="size-5 shrink-0" aria-hidden />
              <span>More</span>
            </button>
          ) : null}
        </div>
      </nav>

      {hasMore ? (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent
            id="mobile-more-sheet"
            side="bottom"
            className="max-h-[85dvh] gap-0 rounded-t-2xl p-0 pb-[max(env(safe-area-inset-bottom),1rem)] md:hidden"
          >
            <SheetHeader className="border-b px-4 py-3 text-left">
              <SheetTitle>More</SheetTitle>
              <SheetDescription>
                All other tools for your role, grouped by job.
              </SheetDescription>
            </SheetHeader>

            <div className="overflow-y-auto px-3 py-3">
              {layout.moreGroups.map((group) => (
                <section key={group.id} className="mb-4 last:mb-0">
                  <h3
                    className={cn(
                      "mb-2 px-2 text-xs font-semibold tracking-wide uppercase",
                      group.emphasis === "safety"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {group.label}
                  </h3>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = iconMap[item.icon] ?? LayoutDashboard;
                      const active = isActivePath(pathname, item.href);
                      const isSafety = group.emphasis === "safety";

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={cn(
                              "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                              isSafety && !active
                                ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                                : active
                                  ? "bg-primary text-primary-foreground"
                                  : "text-foreground hover:bg-muted",
                            )}
                          >
                            <Icon className="size-5 shrink-0" aria-hidden />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
