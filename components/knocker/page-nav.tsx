import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Big thumb-friendly prev/next pair that sits above the knocker tab bar.
// Complements the icon-only footer nav with clear wordy arrows when the
// user is deep in a list page.

export function PageNav({
  prev,
  next,
}: {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}) {
  return (
    <div className="border-t border-border bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        {prev ? (
          <Link
            href={prev.href}
            className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-navy-100 bg-white text-sm font-semibold text-navy-700 active:scale-[0.98]"
          >
            <ChevronLeft className="h-4 w-4" /> {prev.label}
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {next ? (
          <Link
            href={next.href}
            className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-navy-900 bg-navy-900 text-sm font-semibold text-white active:scale-[0.98]"
          >
            {next.label} <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </div>
    </div>
  );
}
