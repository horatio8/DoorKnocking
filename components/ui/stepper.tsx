"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperItem {
  id: string;
  label: string;
  complete?: boolean;
}

interface StepperProps {
  items: StepperItem[];
  currentId: string;
  onSelect?: (id: string) => void;
  className?: string;
}

export function Stepper({ items, currentId, onSelect, className }: StepperProps) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item, idx) => {
        const active = item.id === currentId;
        const done = !!item.complete;
        const clickable = !!onSelect;
        const Tag: "button" | "div" = clickable ? "button" : "div";
        return (
          <li key={item.id} className="flex items-center gap-2">
            <Tag
              type={clickable ? "button" : undefined}
              onClick={clickable ? () => onSelect?.(item.id) : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs transition",
                active && "bg-navy text-white",
                !active && done && "bg-emerald-100 text-emerald-800",
                !active && !done && "bg-navy-50 text-navy-500",
                clickable && "hover:opacity-90",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold",
                  active && "bg-white text-navy",
                  !active && done && "bg-emerald-600 text-white",
                  !active && !done && "bg-navy-100 text-navy-500",
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : idx + 1}
              </span>
              {item.label}
            </Tag>
            {idx < items.length - 1 ? (
              <span className="h-px w-4 bg-navy-100" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
