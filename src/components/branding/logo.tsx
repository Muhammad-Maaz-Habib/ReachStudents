import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: { wordmark: "text-lg", tagline: "text-[10px]" },
  md: { wordmark: "text-xl", tagline: "text-xs" },
  lg: { wordmark: "text-2xl", tagline: "text-sm" },
};

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="flex size-10 items-center justify-center rounded-2xl shadow-sm"
        style={{
          background: "linear-gradient(135deg, #E07A3A 0%, #2D6A4F 100%)",
        }}
        aria-hidden
      >
        <span className="text-sm font-bold text-white">W</span>
      </div>
      {showText && (
        <div>
          <p
            className={cn(
              "font-semibold tracking-tight text-foreground",
              sizeMap[size].wordmark,
            )}
          >
            Waypoint
          </p>
          <p className={cn("text-muted-foreground", sizeMap[size].tagline)}>
            Summer conference hub
          </p>
        </div>
      )}
    </div>
  );
}
