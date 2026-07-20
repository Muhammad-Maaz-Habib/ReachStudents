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
