import { cn } from "@/lib/utils";

// Stripe-Elements stand-in — monospaced fake card number with VISA/MC/AMEX
// brand chips on the right, stacked expiry / CVV / ZIP grid below. See
// design_handoff_onboarding_flow/paywall.jsx § StripeCardInput.

export function StripeCardInput({
  variant = "light",
  className,
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const dark = variant === "dark";
  const base =
    dark
      ? "bg-parchment/[0.06] border-parchment/20 text-parchment"
      : "bg-white border-rule text-ink";
  const muted = dark ? "text-parchment/40" : "text-mute";
  return (
    <div className={cn("font-mono text-sm", className)}>
      <div
        className={cn(
          "mb-2 flex items-center gap-2.5 rounded-sm border px-3 py-[11px]",
          base,
        )}
      >
        <CardGlyph className={cn("h-4 w-4", muted)} />
        <span>4242 4242 4242 4242</span>
        <span className="ml-auto flex gap-1">
          {["VISA", "MC", "AMEX"].map((b) => (
            <span
              key={b}
              className={cn(
                "border px-1.5 py-[2px] text-[9px] tracking-[0.1em]",
                muted,
              )}
              style={{ borderColor: "currentColor" }}
            >
              {b}
            </span>
          ))}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className={cn("rounded-sm border px-3 py-[11px]", base)}>05 / 29</div>
        <div className={cn("rounded-sm border px-3 py-[11px]", base)}>•••</div>
        <div className={cn("rounded-sm border px-3 py-[11px]", base)}>29401</div>
      </div>
    </div>
  );
}

function CardGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...props}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="0.5" />
      <path d="M1.5 6.5h13M4 10h3" />
    </svg>
  );
}
