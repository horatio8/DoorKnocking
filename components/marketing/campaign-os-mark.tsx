// Campaign OS brand mark — shield + stripes + star. Matches the handoff's
// <CampaignOSMark /> in design_handoff_onboarding_flow/shared.jsx.

export function CampaignOSMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M20 3 L35 8 V20 C35 29 28 35 20 37 C12 35 5 29 5 20 V8 Z"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M5 14 H35 M5 20 H35 M5 26 H35"
        stroke="currentColor"
        strokeWidth={0.6}
        opacity={0.35}
      />
      <path
        d="M20 11 L21.4 14.2 L24.8 14.5 L22.3 16.8 L23 20.1 L20 18.4 L17 20.1 L17.7 16.8 L15.2 14.5 L18.6 14.2 Z"
        fill="currentColor"
      />
    </svg>
  );
}
