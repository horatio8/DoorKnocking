import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// Matches design_handoff_onboarding_flow/styles.css § Inputs — 1px rule
// border, 3px radius, focus ring 0 0 0 3px rgba(11,37,69,0.12).

export const CivicInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function CivicInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "block w-full rounded-sm border border-rule bg-white px-3 py-[11px] font-sans text-[15px] text-ink placeholder:text-mute-2",
          "outline-none transition-[border-color,box-shadow] duration-100 focus:border-civic-navy focus:shadow-[0_0_0_3px_rgba(11,37,69,0.12)]",
          className,
        )}
        {...props}
      />
    );
  },
);

export const CivicSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function CivicSelect({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "block w-full appearance-none rounded-sm border border-rule bg-white bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%226%22%20viewBox=%220%200%2010%206%22><path%20fill=%22none%22%20stroke=%22%230B2545%22%20stroke-width=%221.5%22%20d=%22M1%201l4%204%204-4%22/></svg>')] bg-[position:right_12px_center] bg-no-repeat px-3 py-[11px] pr-9 font-sans text-[15px] text-ink",
          "outline-none transition-[border-color,box-shadow] duration-100 focus:border-civic-navy focus:shadow-[0_0_0_3px_rgba(11,37,69,0.12)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export function CivicLabel({
  children,
  htmlFor,
  hint,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block font-sans text-xs font-semibold uppercase tracking-[0.06em] text-mute",
        className,
      )}
    >
      {children}
      {hint ? (
        <span className="ml-1 font-sans text-[11px] font-normal normal-case tracking-normal text-mute">
          ({hint})
        </span>
      ) : null}
    </label>
  );
}

export function CivicField({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}
