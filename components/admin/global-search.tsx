"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface Hit {
  kind: "voter" | "household" | "walkbook" | "district" | "user" | "survey" | "tag" | "client";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const KIND_LABEL: Record<Hit["kind"], string> = {
  voter: "Voter",
  household: "Household",
  walkbook: "Walkbook",
  district: "District",
  user: "User",
  survey: "Survey",
  tag: "Tag",
  client: "Client",
};

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced fetch.
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits(null);
      return;
    }
    const handle = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `${res.status}`);
        setHits(body.hits as Hit[]);
        setCursor(-1);
      } catch {
        setHits([]);
      } finally {
        setBusy(false);
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [q]);

  // Cmd/Ctrl-K focuses.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click-outside closes.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  function pick(hit: Hit) {
    setOpen(false);
    setQ("");
    setHits(null);
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!hits || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(hits.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(-1, c - 1));
    } else if (e.key === "Enter" && cursor >= 0) {
      e.preventDefault();
      pick(hits[cursor]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-md border border-navy-100 bg-white px-2 py-1.5 text-sm">
        <Search className="h-4 w-4 text-navy-400" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search voters, walkbooks, clients…"
          className="flex-1 bg-transparent text-sm focus:outline-none"
          aria-label="Global search"
        />
        <span className="hidden text-[10px] text-navy-400 md:inline">⌘K</span>
      </div>

      {open && (hits !== null || busy) ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[70vh] overflow-auto rounded-md border border-navy-100 bg-white shadow-lg">
          {busy && !hits ? (
            <p className="p-3 text-xs text-muted-foreground">Searching…</p>
          ) : hits && hits.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No matches for &ldquo;{q}&rdquo;.</p>
          ) : (
            <ul className="py-1 text-sm">
              {hits!.map((h, i) => (
                <li key={`${h.kind}-${h.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => pick(h)}
                    className={`flex w-full items-start gap-2 px-3 py-1.5 text-left transition ${
                      i === cursor ? "bg-navy-50" : "hover:bg-navy-50/60"
                    }`}
                  >
                    <span className="min-w-14 text-[10px] font-semibold uppercase tracking-widest text-navy-400">
                      {KIND_LABEL[h.kind]}
                    </span>
                    <span className="flex-1">
                      <span className="block text-navy-900">{h.title}</span>
                      {h.subtitle ? (
                        <span className="block text-xs text-muted-foreground">{h.subtitle}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
