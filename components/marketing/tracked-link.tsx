"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { trackFunnel, type FunnelEvent } from "@/lib/marketing/funnel";

// Thin wrapper around Next <Link> that fires a funnel event on click.
// Used for the homepage CTAs (signup / pricing / signin) — the handoff
// asks for one tracked event per CTA.

type Props = ComponentProps<typeof Link> & {
  event: FunnelEvent;
  eventProps?: Record<string, unknown>;
};

export function TrackedLink({ event, eventProps, children, onClick, ...rest }: Props) {
  return (
    <Link
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        trackFunnel(event, eventProps);
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
