import { UserRole } from "@/generated/prisma/browser";
import {
  NAV_ITEMS,
  PARENT_NAV_ITEMS,
  STUDENT_NAV_ITEMS,
} from "@/lib/constants";

export type MobileNavItem = {
  href: string;
  label: string;
  icon: string;
};

export type MobileNavGroup = {
  id: string;
  label: string;
  /** Highlight group for safety-critical links */
  emphasis?: "safety";
  items: MobileNavItem[];
};

export type MobileNavLayout = {
  primary: MobileNavItem[];
  moreGroups: MobileNavGroup[];
};

const STAFF_PRIMARY_HREFS = [
  "/dashboard",
  "/checkin",
  "/schedule",
  "/messages",
] as const;

const NURSE_PRIMARY_HREFS = [
  "/dashboard",
  "/health",
  "/checkin",
  "/emergency",
] as const;

/** Order of groups and items inside the More sheet (staff / nurse). */
const MORE_GROUP_DEFS: {
  id: string;
  label: string;
  emphasis?: "safety";
  hrefs: string[];
}[] = [
  {
    id: "safety",
    label: "Safety",
    emphasis: "safety",
    hrefs: ["/emergency"],
  },
  {
    id: "people",
    label: "People & programs",
    hrefs: [
      "/roster",
      "/mentor-groups",
      "/clubs",
      "/excursions",
      "/staff",
    ],
  },
  {
    id: "day",
    label: "Day operations",
    hrefs: ["/leave", "/announcements", "/schedule", "/messages", "/checkin"],
  },
  {
    id: "care",
    label: "Care & records",
    hrefs: ["/health", "/incidents", "/forms"],
  },
  {
    id: "admin",
    label: "Admin",
    hrefs: ["/reports", "/settings", "/dashboard"],
  },
];

function byHref(items: readonly MobileNavItem[]) {
  return new Map(items.map((item) => [item.href, item]));
}

function pickPrimary(
  itemsByHref: Map<string, MobileNavItem>,
  hrefs: readonly string[],
): MobileNavItem[] {
  return hrefs
    .map((href) => itemsByHref.get(href))
    .filter((item): item is MobileNavItem => Boolean(item));
}

function buildMoreGroups(
  itemsByHref: Map<string, MobileNavItem>,
  primaryHrefs: Set<string>,
): MobileNavGroup[] {
  const used = new Set<string>(primaryHrefs);
  const groups: MobileNavGroup[] = [];

  for (const def of MORE_GROUP_DEFS) {
    const items = def.hrefs
      .filter((href) => !used.has(href))
      .map((href) => itemsByHref.get(href))
      .filter((item): item is MobileNavItem => Boolean(item));

    if (items.length === 0) continue;

    for (const item of items) used.add(item.href);
    groups.push({
      id: def.id,
      label: def.label,
      emphasis: def.emphasis,
      items,
    });
  }

  // Any nav items not covered by primary or group defs land in Other
  const leftovers = [...itemsByHref.values()].filter(
    (item) => !used.has(item.href),
  );
  if (leftovers.length > 0) {
    groups.push({ id: "other", label: "Other", items: leftovers });
  }

  return groups;
}

function staffLayout(
  items: readonly MobileNavItem[],
  primaryHrefs: readonly string[],
): MobileNavLayout {
  const itemsByHref = byHref(items);
  const primary = pickPrimary(itemsByHref, primaryHrefs);
  const moreGroups = buildMoreGroups(itemsByHref, new Set(primaryHrefs));
  return { primary, moreGroups };
}

/**
 * Role-aware mobile IA:
 * - Staff/Admin: high-frequency shift tabs + More (grouped), Emergency at top of More
 * - Nurse: care-focused primary tabs (incl. Emergency) + More for the rest
 * - Parent / Student: small sets — all items in the bottom bar, no More
 */
export function getMobileNavLayout(
  role: UserRole,
  items: readonly MobileNavItem[],
): MobileNavLayout {
  if (role === UserRole.PARENT || role === UserRole.STUDENT) {
    return { primary: [...items], moreGroups: [] };
  }

  if (role === UserRole.NURSE) {
    return staffLayout(items, NURSE_PRIMARY_HREFS);
  }

  // SUPER_ADMIN, SESSION_ADMIN, STAFF — and any future staff-like roles
  return staffLayout(items, STAFF_PRIMARY_HREFS);
}

/** For verification / tests: expected coverage of known nav catalogs. */
export function assertMobileNavCoversCatalog(
  role: UserRole,
  catalog: readonly MobileNavItem[],
): { ok: boolean; missing: string[] } {
  const layout = getMobileNavLayout(role, catalog);
  const covered = new Set([
    ...layout.primary.map((i) => i.href),
    ...layout.moreGroups.flatMap((g) => g.items.map((i) => i.href)),
  ]);
  const missing = catalog
    .map((i) => i.href)
    .filter((href) => !covered.has(href));
  return { ok: missing.length === 0, missing };
}

export const MOBILE_NAV_CATALOGS = {
  staff: NAV_ITEMS,
  parent: PARENT_NAV_ITEMS,
  student: STUDENT_NAV_ITEMS,
} as const;
