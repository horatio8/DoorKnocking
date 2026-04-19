"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { userInitials, userAvatarBackground, userAvatarForeground } from "@/lib/users/avatar";

// Multi-select volunteer filter for the walkbooks page. Drives URL state so
// the server component can re-render with only the matching groups.
//
// URL shape:
//   ?v=uid1,uid2   -> select those volunteers
//   ?u=1           -> include Unassigned
//   (none)         -> show everyone
export function VolunteerFilterChips({
  volunteers,
  hasUnassigned,
  selectedIds,
  unassignedSelected,
  view,
}: {
  volunteers: Array<{ id: string; name: string; email: string; count: number }>;
  hasUnassigned: boolean;
  selectedIds: string[];
  unassignedSelected: boolean;
  view: "grouped" | "flat";
}) {
  const router = useRouter();
  const search = useSearchParams();
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  function push(nextIds: string[], nextUnassigned: boolean) {
    const params = new URLSearchParams(search.toString());
    if (nextIds.length > 0) params.set("v", nextIds.join(","));
    else params.delete("v");
    if (nextUnassigned) params.set("u", "1");
    else params.delete("u");
    if (view === "flat") params.set("view", "flat");
    const qs = params.toString();
    router.replace(`/admin/walkbooks${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    push(Array.from(next), unassignedSelected);
  }

  function toggleUnassigned() {
    push(Array.from(selected), !unassignedSelected);
  }

  function clearAll() {
    push([], false);
  }

  const filterActive = selected.size > 0 || unassignedSelected;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">
          Filter by volunteer
        </p>
        {filterActive ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-full border border-navy-200 bg-white px-2 py-0.5 text-[11px] font-medium text-navy-700 hover:bg-navy-50"
          >
            <X className="h-3 w-3" /> Clear ({selected.size + (unassignedSelected ? 1 : 0)})
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={clearAll}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            !filterActive
              ? "border-navy-900 bg-navy-900 text-white"
              : "border-navy-200 bg-white text-navy-700 hover:bg-navy-50"
          }`}
        >
          All ({volunteers.length + (hasUnassigned ? 1 : 0)})
        </button>

        {volunteers.map((v) => {
          const isSelected = selected.has(v.id);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => toggle(v.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1.5 text-xs font-medium transition ${
                isSelected
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-navy-200 bg-white text-navy-700 hover:bg-navy-50"
              }`}
            >
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold"
                style={{
                  backgroundColor: isSelected ? "rgba(255,255,255,0.15)" : userAvatarBackground(v.id),
                  color: isSelected ? "#ffffff" : userAvatarForeground(v.id),
                }}
                aria-hidden
              >
                {userInitials(v.name, v.email)}
              </span>
              <span className="max-w-[140px] truncate">{v.name || v.email}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  isSelected ? "bg-white/20" : "bg-navy-50 text-navy-700"
                }`}
              >
                {v.count}
              </span>
            </button>
          );
        })}

        {hasUnassigned ? (
          <button
            type="button"
            onClick={toggleUnassigned}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              unassignedSelected
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-dashed border-navy-300 bg-white text-navy-700 hover:bg-navy-50"
            }`}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-current text-[9px]">
              ?
            </span>
            Unassigned
          </button>
        ) : null}
      </div>
    </div>
  );
}
