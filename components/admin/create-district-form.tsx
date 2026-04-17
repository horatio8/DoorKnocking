"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateDistrictForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    country: "US",
    region: "",
    airtable_base_id: "",
    airtable_voters_table_id: "",
    timezone: "America/New_York",
    default_walkbook_size: 20,
  });
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: insertError } = await supabase.from("districts").insert(form);
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) return <Button variant="accent" onClick={() => setOpen(true)}>New district</Button>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-2 rounded-md border border-navy-100 bg-white p-3 md:grid-cols-2"
    >
      <Input
        required
        placeholder="slug (e.g. au-macarthur)"
        value={form.slug}
        onChange={(e) => setForm({ ...form, slug: e.target.value })}
      />
      <Input
        required
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <Input
        required
        placeholder="Country (US, AU)"
        value={form.country}
        onChange={(e) => setForm({ ...form, country: e.target.value })}
      />
      <Input
        required
        placeholder="Region (state/electorate)"
        value={form.region}
        onChange={(e) => setForm({ ...form, region: e.target.value })}
      />
      <Input
        required
        placeholder="Airtable base id"
        value={form.airtable_base_id}
        onChange={(e) => setForm({ ...form, airtable_base_id: e.target.value })}
      />
      <Input
        required
        placeholder="Airtable voters table id"
        value={form.airtable_voters_table_id}
        onChange={(e) => setForm({ ...form, airtable_voters_table_id: e.target.value })}
      />
      <Input
        placeholder="Timezone"
        value={form.timezone}
        onChange={(e) => setForm({ ...form, timezone: e.target.value })}
      />
      <Input
        type="number"
        placeholder="Default walkbook size"
        value={form.default_walkbook_size}
        onChange={(e) => setForm({ ...form, default_walkbook_size: Number(e.target.value) })}
      />
      <div className="md:col-span-2 flex items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create district"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {error ? <span className="text-xs text-crimson">{error}</span> : null}
      </div>
    </form>
  );
}
