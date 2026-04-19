import { cn } from "@/lib/utils";

// Custom-drawn checkbox / radio matching the civic spec — navy fill when
// checked, parchment check/dot inside. Input is visually hidden but
// receives the real focus + keyboard interactions.

export function CivicCheckbox({
  label,
  checked,
  onCheckedChange,
  children,
  className,
  id,
}: {
  label?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex cursor-pointer items-start gap-2.5 text-sm leading-[1.4] text-ink-2",
        className,
      )}
    >
      <span className="relative mt-0.5 inline-block h-4 w-4 flex-none">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[1px] border border-rule bg-white checked:border-civic-navy checked:bg-civic-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-civic-navy/30"
        />
        <svg
          viewBox="0 0 16 16"
          className="pointer-events-none absolute inset-0 hidden h-full w-full stroke-parchment peer-checked:block"
          fill="none"
          strokeWidth={1.8}
          aria-hidden
        >
          <path d="M3 8.5L6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>{children ?? label}</span>
    </label>
  );
}

export function CivicRadio({
  name,
  value,
  checked,
  onChange,
  children,
  className,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("inline-flex cursor-pointer items-start gap-2.5 text-sm leading-[1.4] text-ink-2", className)}>
      <span className="relative mt-0.5 inline-block h-4 w-4 flex-none">
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
      <span>{children}</span>
    </label>
  );
}
