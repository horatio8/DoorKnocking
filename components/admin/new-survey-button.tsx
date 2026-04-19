"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SURVEY_TEMPLATES } from "@/lib/surveys/templates";

// "+ New survey" kebab — opens an inline card to pick a template or start blank.

export function NewSurveyButton({
  districts,
  defaultDistrictId,
}: {
  districts: Array<{ id: string; name: string }>;
  defaultDistrictId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [districtId, setDistrictId] = useState<string | null>(defaultDistrictId);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !districtId) {
      setError("Name and district required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId,
          name: name.trim(),
          description: description.trim() || undefined,
          templateKey: templateKey ?? undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      router.push(`/admin/surveys/${body.id}/edit`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="accent" onClick={() => setOpen(true)} disabled={districts.length === 0}>
        <Plus className="mr-1.5 h-4 w-4" /> New survey
      </Button>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-lg border border-navy-300 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy-900">Start a new survey</p>
        <button type="button" onClick={() => setOpen(false)} className="text-navy-400 hover:text-navy-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-xs md:col-span-2">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="HD115 Primary Persuasion Wave 1" />
        </label>
        <label className="text-xs">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">District</span>
          <select
            value={districtId ?? ""}
            onChange={(e) => setDistrictId(e.target.value || null)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
          >
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs md:col-span-3">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">Description</span>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — helps admins remember the purpose."
          />
        </label>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-navy-500">
        Start from…
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <TemplateCard
          selected={templateKey === null}
          onClick={() => setTemplateKey(null)}
          title="Blank survey"
          description="Start with no questions. Add them yourself."
          count={0}
        />
        {SURVEY_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.key}
            selected={templateKey === t.key}
            onClick={() => setTemplateKey(t.key)}
            title={t.name}
            description={t.description}
            count={t.questions.length}
          />
        ))}
      </div>

      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Button onClick={create} variant="accent" disabled={busy}>
          {busy ? "Creating…" : "Create draft"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TemplateCard({
  selected,
  onClick,
  title,
  description,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md border p-3 text-left transition ${
        selected ? "border-navy-900 bg-navy-50" : "border-border bg-white hover:border-navy-300"
      }`}
    >
      <p className="text-sm font-medium text-navy-900">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-navy-500">
        {count} {count === 1 ? "question" : "questions"}
      </p>
    </button>
  );
}
