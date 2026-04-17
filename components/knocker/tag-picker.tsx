"use client";

import { useState } from "react";
import { v4 as uuid } from "uuid";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { enqueue } from "@/lib/offline/db";
import { Plus } from "lucide-react";
import type { Tag } from "@/lib/types";

interface Props {
  districtId: string;
  voterId: string;
  standardTags: Tag[];
  selected: string[];
  onChange(ids: string[]): void;
}

export function TagPicker({ districtId, voterId, standardTags, selected, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>(standardTags);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const visible = tags.filter((t) => t.label.toLowerCase().includes(query.toLowerCase()));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  async function createTag() {
    if (!query.trim() || creating) return;
    setCreating(true);
    const label = query.trim();
    const supabase = getSupabaseBrowserClient();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    const id = uuid();
    const newTag: Tag = {
      id,
      district_id: districtId,
      label,
      color: null,
      is_standard: false,
      created_by: userId,
      promoted_by: null,
      promoted_at: null,
      usage_count: 0,
      created_at: new Date().toISOString(),
    };
    setTags((prev) => [...prev, newTag]);
    onChange([...selected, id]);
    setQuery("");
    await enqueue({
      id,
      endpoint: "tag",
      payload: {
        id,
        district_id: districtId,
        label,
        is_standard: false,
        created_by: userId,
      },
    });
    // Also queue the voter_tag row so the application survives the first sync.
    await enqueue({
      id: uuid(),
      endpoint: "voter_tag",
      payload: {
        voter_id: voterId,
        tag_id: id,
        applied_by: userId,
      },
    });
    setCreating(false);
  }

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-widest text-navy-700">Tags</label>
      <div className="mt-1 rounded-md border border-input bg-white">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or add a tag"
          className="w-full rounded-t-md px-3 py-2 text-sm focus:outline-none"
        />
        <div className="max-h-40 overflow-y-auto border-t border-border p-2">
          {visible.length === 0 ? (
            <button
              type="button"
              onClick={createTag}
              className="flex w-full items-center gap-2 rounded-md bg-navy-50 px-3 py-2 text-left text-xs font-medium text-navy-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Create custom tag &quot;{query || "…"}&quot;
            </button>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {visible.map((t) => {
                const isSelected = selected.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggle(t.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      isSelected
                        ? "border-navy bg-navy text-white"
                        : "border-navy-100 bg-white text-navy-700 hover:bg-navy-50"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
              {query ? (
                <button
                  type="button"
                  onClick={createTag}
                  className="rounded-full border border-dashed border-navy-100 px-3 py-1 text-xs text-navy-700"
                >
                  + &quot;{query}&quot;
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
