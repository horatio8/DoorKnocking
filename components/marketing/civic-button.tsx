import Link from "next/link";
import { cn } from "@/lib/utils";

// The civic button — see design_handoff_onboarding_flow/styles.css § Buttons.
// Tight radii (rounded-sm, ≈3px), navy / oxblood / ghost palettes, never pills.
// Use size=lg for card primary actions; sm for nav chrome.

const variantClasses = {
  primary:
    "bg-civic-navy text-parchment border-civic-navy hover:bg-civic-navy-2",
  oxblood:
    "bg-oxblood text-parchment border-oxblood hover:bg-oxblood-2",
  ghost:
    "bg-transparent text-civic-navy border-rule hover:border-civic-navy hover:bg-parchment",
  link:
    "bg-transparent text-civic-navy border-0 underline underline-offset-[3px] hover:text-oxblood px-1 py-2",
} as const;

const sizeClasses = {
  sm: "px-3.5 py-[7px] text-[13px]",
  md: "px-5 py-[11px] text-sm",
  lg: "px-6 py-3.5 text-[15px]",
} as const;

interface CivicButtonBaseProps {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  className?: string;
  children: React.ReactNode;
}

type CivicButtonProps = CivicButtonBaseProps &
  (
    | ({ as?: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ as: "link"; href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">)
  );

export function CivicButton(props: CivicButtonProps) {
  const { variant = "primary", size = "md", className, children, ...rest } = props as CivicButtonProps & {
    as?: string;
  };
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-sm border font-sans font-semibold tracking-[0.01em] whitespace-nowrap transition-[background,border,transform] duration-100 active:translate-y-[1px]",
    variantClasses[variant],
    sizeClasses[size],
    variant === "link" && "rounded-none border-0", // link variant skips the frame
    className,
  );

  if ((rest as { as?: string }).as === "link") {
    const { as: _as, href, ...anchor } = rest as { as: "link"; href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href} className={classes} {...anchor}>
        {children}
      </Link>
    );
  }
  const { as: _as, ...btn } = rest as { as?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={classes} {...btn}>
      {children}
    </button>
  );
}
