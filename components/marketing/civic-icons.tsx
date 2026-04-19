// Monoline 16×16 icons matching design_handoff_onboarding_flow/shared.jsx.
// All use stroke="currentColor" so the parent controls the color via text-*.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...props}>
      <path d="M3 8.5L6.5 12 13 4.5" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...props}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...props}>
      <path d="M8 1.5l5.5 2v4.2c0 3.2-2.2 5.8-5.5 6.8-3.3-1-5.5-3.6-5.5-6.8V3.5z" />
      <path d="M5.5 8l2 2 3-3.5" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 1l2.1 4.5L15 6.2l-3.5 3.5.9 5L8 12.3 3.6 14.7l.9-5L1 6.2l4.9-.7z" />
    </svg>
  );
}
