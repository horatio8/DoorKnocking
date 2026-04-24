"use client";

import { useEffect } from "react";
import Link from "next/link";

// Root error boundary for the knocker shell. Any unhandled error in a
// server component or client component under /app/** lands here instead
// of the browser's default 500 screen.

export default function KnockerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("knocker route error:", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-crimson">
          Something broke
        </p>
        <h2 className="font-serif text-xl font-semibold text-navy-900">
          We couldn&rsquo;t load that screen.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Unknown error."}
        </p>
        {error.digest ? (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Ref: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/app/map"
          className="rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-700"
        >
          Back to map
        </Link>
      </div>
    </div>
  );
}
