"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SURVEY_TEMPLATES } from "@/lib/surveys/templates";

type Mode = "blank-or-template" | "brief";

// "+ New survey" — opens an inline card with two entry lanes:
//   1. Pick a blank draft or a prebuilt template (the original flow)
//   2. Paste a brief, let Claude draft the survey, jump into the editor
// Either lane creates a draft + routes to /admin/surveys/:id/edit.

export function NewSurveyButton({
  districts,
  defaultDistrictId,
}: {
  districts: Array<{ id: string; name: string }>;
  defaultDistrictId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("blank-or-template");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [districtId, setDistrictId] = useState<string | null>(defaultDistrictId);
  const [templateKey, setTemplateKey] = useState<string | null>(null);

  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createBlankOrTemplate() {
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

  async function createFromBrief() {
    if (!districtId) {
      setError("District required.");
      return;
    }
    if (brief.trim().length < 12) {
      setError("Describe what you want to learn in at least a sentence.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/surveys/from-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId,
          brief: brief.trim(),
          name: name.trim() || undefined,
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
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-navy-400 hover:text-navy-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode switcher — default is the original flow, so opening this card
          doesn't surprise anyone; the brief flow is one tap away. */}
      <div className="mt-3 inline-flex rounded-full border border-navy-200 bg-white p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode("blank-or-template")}
          className={`rounded-full px-3 py-1.5 font-medium ${
            mode === "blank-or-template" ? "bg-navy-900 text-white" : "text-navy-700"
          }`}
        >
          Blank or template
        </button>
        <button
          type="button"
          onClick={() => setMode("brief")}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium ${
            mode === "brief" ? "bg-navy-900 text-white" : "text-navy-700"
          }`}
        >
          <Sparkles className="h-3 w-3" /> Generate from brief
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-xs md:col-span-2">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">
            Name{" "}
            {mode === "brief" ? (
              <span className="font-normal normal-case tracking-normal text-muted-foreground">
                (optional — AI suggests one)
              </span>
            ) : null}
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              mode === "brief"
                ? "Leave blank to let the AI name it"
                : "HD115 Primary Persuasion Wave 1"
            }
          />
        </label>
        <label className="text-xs">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">
            District
          </span>
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
        {mode === "blank-or-template" ? (
          <label className="text-xs md:col-span-3">
            <span className="block font-semibold uppercase tracking-widest text-navy-500">
              Description
            </span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — helps admins remember the purpose."
            />
          </label>
        ) : null}
      </div>

      {mode === "blank-or-template" ? (
        <>
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
        </>
      ) : (
        <>
          <label className="mt-4 block text-xs">
            <span className="block font-semibold uppercase tracking-widest text-navy-500">
              Your brief
            </span>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Describe what you want to learn and anything we should ask about. Claude drafts
              3–8 questions you can edit before publishing.
            </span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder={`Example: "I want to know how HD115 voters feel about the new school-zoning proposal. Ask who they'd support if the vote were today, what they think of the proposal, and whether they'd attend a town hall."`}
              className="mt-2 w-full rounded-md border border-navy-200 bg-white p-2.5 text-sm leading-snug"
            />
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground">
            <Sparkles className="-mt-0.5 mr-1 inline h-3 w-3" />
            Draft only — review + edit the questions before publishing.
          </p>
        </>
      )}

      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        {mode === "blank-or-template" ? (
          <Button onClick={createBlankOrTemplate} variant="accent" disabled={busy}>
            {busy ? "Creating…" : "Create draft"}
          </Button>
        ) : (
          <Button onClick={createFromBrief} variant="accent" disabled={busy}>
            {busy ? "Generating…" : "Generate & open editor"}
          </Button>
        )}
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
