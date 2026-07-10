import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      status: {
        success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      status: "neutral",
    },
  },
);

type StatusBadgeProps = VariantProps<typeof statusBadgeVariants> & {
  label: string;
  className?: string;
  title?: string;
};

export function StatusBadge({ status, label, className, title }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ status }), className)} title={title}>
      <span
        className={cn("size-1.5 rounded-full", {
          "bg-emerald-500": status === "success",
          "bg-amber-500": status === "warning",
          "bg-red-500": status === "danger",
          "bg-sky-500": status === "info",
          "bg-muted-foreground": status === "neutral" || !status,
        })}
        aria-hidden
      />
      {label}
    </span>
  );
}
