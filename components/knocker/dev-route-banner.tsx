"use client";

import { useEffect, useState } from "react";

// Tiny dev banner pinned to the top of a page so QA can confirm at a
// glance which route actually rendered — independent of whatever the
// URL bar is showing. Intended as temporary instrumentation while we
// chase a routing loop.
export function DevRouteBanner({ label }: { label: string }) {
  const [path, setPath] = useState("…");
  useEffect(() => {
    setPath(window.location.pathname + window.location.search);
  }, []);
  return (
    <div className="bg-yellow-300 px-3 py-1 text-center text-[11px] font-semibold text-black">
      {label} · {path}
    </div>
  );
}
