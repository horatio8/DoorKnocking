import { cn } from "@/lib/utils";

// 11px / 0.14em / 600 / uppercase — the civic "eyebrow" label used above h1s,
// inside nav chrome, and above plan-card numerals.

export function Eyebrow({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "oxblood" | "on-navy";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-sans text-[11px] font-semibold uppercase tracking-[0.14em]",
        variant === "default" && "text-mute",
        variant === "oxblood" && "text-oxblood",
        variant === "on-navy" && "text-parchment/60",
        className,
      )}
    >
      {children}
    </span>
  );
}
