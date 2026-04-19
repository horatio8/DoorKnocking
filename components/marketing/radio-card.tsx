"use client";

import { cn } from "@/lib/utils";

// Full-width tappable radio-backed card used throughout the wizard + paywall.
// Active state is navy border + parchment fill (see wizard.jsx step 1).

export function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  trailing,
  children,
  className,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 border p-3.5 transition-colors",
        checked ? "border-civic-navy bg-parchment" : "border-rule bg-white hover:border-civic-navy/40",
        className,
      )}
    >
      <span className="relative mt-1 inline-block h-4 w-4 flex-none">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onChange(value)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full border border-rule bg-white checked:border-civic-navy checked:bg-civic-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-civic-navy/30"
        />
        <span className="pointer-events-none absolute left-1/2 top-1/2 hidden h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-parchment peer-checked:block" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-sans text-sm font-semibold text-ink">{title}</span>
          {trailing}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[12.5px] text-mute">{description}</span>
        ) : null}
        {children}
      </span>
    </label>
  );
}
