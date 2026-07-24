import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

type LogoProps = {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  /** Org display name; falls back to product name (Waypoint). */
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

const sizeMap = {
  sm: { wordmark: "text-lg", tagline: "text-[10px]", mark: "size-9", img: 36 },
  md: { wordmark: "text-xl", tagline: "text-xs", mark: "size-10", img: 40 },
  lg: { wordmark: "text-2xl", tagline: "text-sm", mark: "size-12", img: 48 },
};

export function Logo({
  className,
  showText = true,
  size = "md",
  name,
  logoUrl,
  primaryColor,
  secondaryColor,
}: LogoProps) {
  const displayName = name?.trim() || APP_NAME;
  const primary = primaryColor?.trim() || "#E07A3A";
  const secondary = secondaryColor?.trim() || "#2D6A4F";
  const initial = displayName.charAt(0).toUpperCase() || "W";
  const isProductDefault = displayName === APP_NAME;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {logoUrl ? (
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-2xl border bg-background shadow-sm",
            sizeMap[size].mark,
          )}
        >
          {/* External logo URLs — next/image requires remotePatterns; use img for v1 URL field. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            width={sizeMap[size].img}
            height={sizeMap[size].img}
            className="size-full object-contain p-1"
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl shadow-sm",
            sizeMap[size].mark,
          )}
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
          }}
          aria-hidden
        >
          <span className="text-sm font-bold text-white">{initial}</span>
        </div>
      )}
      {showText && (
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-semibold tracking-tight text-foreground",
              sizeMap[size].wordmark,
            )}
          >
            {displayName}
          </p>
          <p className={cn("text-muted-foreground", sizeMap[size].tagline)}>
            {isProductDefault ? "Summer conference hub" : "Conference hub"}
          </p>
        </div>
      )}
    </div>
  );
}
