import { cn } from "@/lib/utils";

// Small civic badge with optional leading dot. Matches .badge / .badge.green
// etc in design_handoff_onboarding_flow/styles.css.

type Variant = "navy" | "oxblood" | "green" | "amber" | "mute";

const variantClasses: Record<Variant, { text: string; bg: string; border: string; dot: string }> = {
  navy: { text: "text-civic-navy", bg: "bg-civic-navy/10", border: "border-civic-navy/30", dot: "bg-civic-navy" },
  oxblood: { text: "text-oxblood", bg: "bg-oxblood/10", border: "border-oxblood/30", dot: "bg-oxblood" },
  green: { text: "text-civic-green", bg: "bg-civic-green/10", border: "border-civic-green/30", dot: "bg-civic-green" },
  amber: { text: "text-civic-amber", bg: "bg-civic-amber/10", border: "border-civic-amber/30", dot: "bg-civic-amber" },
  mute: { text: "text-mute", bg: "bg-mute/10", border: "border-rule", dot: "bg-mute" },
};

export function CivicBadge({
  variant = "mute",
  solid,
  dot,
  children,
  className,
}: {
  variant?: Variant;
  solid?: boolean;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const v = variantClasses[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-[2px] font-sans text-[10px] font-semibold uppercase tracking-[0.14em]",
        solid ? `${v.bg} ${v.border} ${v.text}` : `border-transparent ${v.text}`,
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 flex-none rounded-full", v.dot)} /> : null}
      {children}
    </span>
  );
}
