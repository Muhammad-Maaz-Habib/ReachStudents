/** Shared activity colors — calendar, forms, and dashboard donut. */
export const ACTIVITY_COLOR_PALETTE = [
  "#E07A3A", // terracotta (brand primary)
  "#2D6A4F", // forest (brand secondary)
  "#457B9D", // steel blue
  "#C9A227", // gold
  "#6D597A", // plum
  "#E76F51", // coral
  "#264653", // deep teal
  "#8AB17D", // sage
] as const;

export type ActivityColor = (typeof ACTIVITY_COLOR_PALETTE)[number];

export function nextActivityColor(existingColors: (string | null | undefined)[]) {
  const used = new Set(
    existingColors
      .filter((color): color is string => !!color)
      .map((color) => color.toUpperCase()),
  );

  const unused = ACTIVITY_COLOR_PALETTE.find(
    (color) => !used.has(color.toUpperCase()),
  );
  if (unused) return unused;

  return ACTIVITY_COLOR_PALETTE[
    existingColors.length % ACTIVITY_COLOR_PALETTE.length
  ];
}

export function normalizeActivityColor(
  color: string | null | undefined,
  fallbackIndex = 0,
) {
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) return color;
  return ACTIVITY_COLOR_PALETTE[fallbackIndex % ACTIVITY_COLOR_PALETTE.length];
}

/** Stable palette index from an activity id (same id → same color). */
export function colorIndexFromId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % ACTIVITY_COLOR_PALETTE.length;
}

/**
 * Color for charts/calendar: prefer stored Activity.color, otherwise a
 * deterministic palette pick from the activity id so slices stay distinct
 * and match across dashboard + schedule.
 */
export function colorForActivity(
  activityId: string,
  storedColor?: string | null,
) {
  return normalizeActivityColor(storedColor, colorIndexFromId(activityId));
}
