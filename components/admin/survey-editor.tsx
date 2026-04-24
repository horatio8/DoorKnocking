"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Copy,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  PauseCircle,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toSlug } from "@/lib/surveys/slug";
import type {
  SurveyMetaDraft,
  SurveyQuestionDraft,
  SurveyQuestionType,
  SurveyOption,
} from "@/lib/surveys/types";
import { SurveyQuestionPreview } from "./survey-question-preview";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

const TYPE_LABELS: Record<SurveyQuestionType, string> = {
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  short_text: "Short text",
  long_text: "Long text",
  yes_no: "Yes / No",
  rating_1_5: "Rating 1–5",
  scale_0_10: "Scale 0–10",
  info: "Info screen",
};

export interface EditorWalkbook {
  id: string;
  name: string;
  household_count: number;
  status: string;
  kind: string;
}

export function SurveyEditor({
  meta,
  initialQuestions,
  walkbooks = [],
  attachedWalkbookIds = [],
}: {
  meta: SurveyMetaDraft;
  initialQuestions: SurveyQuestionDraft[];
  walkbooks?: EditorWalkbook[];
  attachedWalkbookIds?: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(meta.name);
  const [description, setDescription] = useState(meta.description ?? "");
  const [visibility, setVisibility] = useState<"all_houses" | "assigned_only">(meta.visibility);
  const [priority, setPriority] = useState(meta.priority);
  const [questions, setQuestions] = useState<SurveyQuestionDraft[]>(initialQuestions);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    initialQuestions.length > 0 ? 0 : null,
  );
  const [saving, setSaving] = useState<"idle" | "saving" | "publishing">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ breaking: string[]; nonBreaking: string[] } | null>(null);

  // Walkbook attachment picker state — independent of question save/publish.
  const initialAttached = useMemo(() => new Set(attachedWalkbookIds), [attachedWalkbookIds]);
  const [walkbookSelection, setWalkbookSelection] = useState<Set<string>>(initialAttached);
  const [walkbookSearch, setWalkbookSearch] = useState("");
  const [walkbookSaving, setWalkbookSaving] = useState(false);
  const [walkbookNotice, setWalkbookNotice] = useState<string | null>(null);
  const [walkbookError, setWalkbookError] = useState<string | null>(null);

  const selected = selectedIdx !== null ? questions[selectedIdx] : null;
  const isPublished = meta.status === "active";

  function patchSelected(patch: Partial<SurveyQuestionDraft>) {
    if (selectedIdx === null) return;
    setQuestions((qs) => qs.map((q, i) => (i === selectedIdx ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    const idx = questions.length;
    const q: SurveyQuestionDraft = {
      question_key: `q${idx + 1}`,
      order_index: idx + 1,
      question_text: "New question",
      question_type: "single_choice",
      required: false,
      help_text: null,
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
      min_value: null,
      max_value: null,
      body_html: null,
    };
    setQuestions((qs) => [...qs, q]);
    setSelectedIdx(idx);
  }

  function addInfoScreen() {
    const idx = questions.length;
    const q: SurveyQuestionDraft = {
      question_key: `info${idx + 1}`,
      order_index: idx + 1,
      question_text: "Info screen",
      question_type: "info",
      required: false,
      help_text: null,
      options: null,
      min_value: null,
      max_value: null,
      body_html: "<p>Write the script or intro your volunteer should read here.</p>",
    };
    setQuestions((qs) => [...qs, q]);
    setSelectedIdx(idx);
  }

  function removeSelected() {
    if (selectedIdx === null) return;
    if (!confirm("Delete this question?")) return;
    setQuestions((qs) => qs.filter((_, i) => i !== selectedIdx).map((q, i) => ({ ...q, order_index: i + 1 })));
    setSelectedIdx((i) => (i === null ? null : Math.max(0, i - 1)));
  }

  function move(idx: number, delta: -1 | 1) {
    const target = idx + delta;
    if (target < 0 || target >= questions.length) return;
    setQuestions((qs) => {
      const next = [...qs];
      const [q] = next.splice(idx, 1);
      next.splice(target, 0, q);
      return next.map((q, i) => ({ ...q, order_index: i + 1 }));
    });
    setSelectedIdx(target);
  }

  async function save(opts?: { force?: boolean }): Promise<boolean> {
    setSaving("saving");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/surveys/${meta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          visibility,
          priority,
          questions: questions.map((q, i) => ({ ...q, order_index: i + 1 })),
          force: opts?.force ?? false,
        }),
      });
      const body = await res.json();
      if (res.status === 409 && body.error === "breaking_changes") {
        setDiff(body.diff);
        setSaving("idle");
        return false;
      }
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setNotice("Saved.");
      setSaving("idle");
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      setSaving("idle");
      return false;
    }
  }

  async function publish() {
    setSaving("publishing");
    setError(null);
    setNotice(null);
    const ok = await save();
    if (!ok) {
      setSaving("idle");
      return;
    }
    try {
      const res = await fetch(`/api/admin/surveys/${meta.id}/publish`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        if (body.problems) {
          setError(`Can't publish: ${body.problems.join(", ")}`);
        } else {
          throw new Error(body.error ?? `${res.status}`);
        }
        setSaving("idle");
        return;
      }
      setNotice(`Published as v${body.version}.`);
      setSaving("idle");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSaving("idle");
    }
  }

  async function setStatus(status: "paused" | "archived" | "draft") {
    const res = await fetch(`/api/admin/surveys/${meta.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? `${res.status}`);
      return;
    }
    setNotice(`Status → ${status}.`);
    router.refresh();
  }

  async function duplicate() {
    const res = await fetch(`/api/admin/surveys/${meta.id}/duplicate`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    router.push(`/admin/surveys/${body.id}/edit`);
  }

  const slug = useMemo(() => meta.slug || toSlug(name), [meta.slug, name]);

  const filteredWalkbooks = useMemo(() => {
    const q = walkbookSearch.trim().toLowerCase();
    if (!q) return walkbooks;
    return walkbooks.filter((w) => w.name.toLowerCase().includes(q));
  }, [walkbooks, walkbookSearch]);

  const walkbookDirty = useMemo(() => {
    if (walkbookSelection.size !== initialAttached.size) return true;
    for (const id of walkbookSelection) {
      if (!initialAttached.has(id)) return true;
    }
    return false;
  }, [walkbookSelection, initialAttached]);

  function toggleWalkbook(id: string) {
    setWalkbookSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveWalkbookAttachments() {
    if (!meta.id) return;
    setWalkbookSaving(true);
    setWalkbookError(null);
    setWalkbookNotice(null);
    try {
      const res = await fetch(`/api/admin/surveys/${meta.id}/walkbooks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(walkbookSelection) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      const parts: string[] = [];
      if (body.added) parts.push(`+${body.added}`);
      if (body.removed) parts.push(`-${body.removed}`);
      setWalkbookNotice(
        `Attached to ${body.attached} walkbook${body.attached === 1 ? "" : "s"}${
          parts.length > 0 ? ` (${parts.join(" / ")})` : ""
        }.`,
      );
      router.refresh();
    } catch (e) {
      setWalkbookError((e as Error).message);
    } finally {
      setWalkbookSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/surveys"
            className="inline-flex items-center gap-1 text-xs text-navy-700 hover:text-navy-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All surveys
          </Link>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-navy-900">{name || "Untitled"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={meta.status} />
            <span>v{meta.current_version}</span>
            <span>slug: {slug || "—"}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={duplicate}>
            <Copy className="mr-1.5 h-4 w-4" /> Duplicate
          </Button>
          {meta.status === "active" ? (
            <Button variant="outline" onClick={() => setStatus("paused")}>
              <PauseCircle className="mr-1.5 h-4 w-4" /> Pause
            </Button>
          ) : null}
          {meta.status === "paused" ? (
            <Button variant="outline" onClick={() => setStatus("draft")}>
              Move to draft
            </Button>
          ) : null}
          {meta.status !== "archived" ? (
            <Button variant="ghost" onClick={() => setStatus("archived")}>
              <Archive className="mr-1.5 h-4 w-4" /> Archive
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => save()} disabled={saving !== "idle"}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving === "saving" ? "Saving…" : "Save"}
          </Button>
          <Button variant="accent" onClick={publish} disabled={saving !== "idle"}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {saving === "publishing"
              ? "Publishing…"
              : isPublished
                ? `Re-publish v${meta.current_version + 1}`
                : "Publish"}
          </Button>
        </div>
      </div>

      {notice ? (
        <p className="rounded bg-emerald-100 px-3 py-2 text-xs text-emerald-800">{notice}</p>
      ) : null}
      {error ? (
        <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}
      {diff ? (
        <BreakingChangesPrompt
          diff={diff}
          onForce={async () => {
            setDiff(null);
            await save({ force: true });
          }}
          onCancel={() => setDiff(null)}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <section className="space-y-4 rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">Metadata</p>
          <label className="block text-xs">
            <span className="block font-medium text-navy-500">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-xs">
            <span className="block font-medium text-navy-500">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-navy-200 p-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="block font-medium text-navy-500">Visibility</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
            >
              <option value="all_houses">All houses</option>
              <option value="assigned_only">Assigned only</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="block font-medium text-navy-500">Priority</span>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
            />
          </label>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">
                Questions ({questions.length})
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={addInfoScreen}
                  title="Read-only info/script screen with a Continue button"
                  className="inline-flex items-center gap-1 rounded-full border border-navy-200 bg-white px-2 py-0.5 text-[11px] font-medium text-navy-700 hover:bg-navy-50"
                >
                  <Plus className="h-3 w-3" /> Info
                </button>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-1 rounded-full border border-navy-200 bg-white px-2 py-0.5 text-[11px] font-medium text-navy-700 hover:bg-navy-50"
                >
                  <Plus className="h-3 w-3" /> Question
                </button>
              </div>
            </div>
            <ul className="space-y-1">
              {questions.map((q, i) => (
                <li key={q.id ?? `new-${i}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedIdx(i)}
                    className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${
                      selectedIdx === i
                        ? "border-navy-900 bg-navy-50"
                        : "border-border bg-white hover:border-navy-300"
                    }`}
                  >
                    <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-navy-100 text-[10px] font-semibold text-navy-700">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{q.question_text || "(empty)"}</span>
                    <span className="text-[10px] text-muted-foreground">{q.question_type.replace("_", " ")}</span>
                  </button>
                </li>
              ))}
              {questions.length === 0 ? (
                <li className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No questions yet.
                </li>
              ) : null}
            </ul>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-border bg-white p-4">
          {selected ? (
            <QuestionEditor
              key={selected.id ?? selectedIdx}
              question={selected}
              canMoveUp={selectedIdx! > 0}
              canMoveDown={selectedIdx! < questions.length - 1}
              onMoveUp={() => move(selectedIdx!, -1)}
              onMoveDown={() => move(selectedIdx!, 1)}
              onDelete={removeSelected}
              onPatch={patchSelected}
            />
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Pick a question on the left to edit, or click <strong>+ Add</strong> to create one.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-navy-50/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-navy-500">
            Phone preview
          </p>
          <div className="mx-auto max-w-xs rounded-2xl border border-navy-200 bg-white p-3 shadow-sm">
            {selected ? (
              <SurveyQuestionPreview question={selected} index={selectedIdx ?? 0} total={questions.length} />
            ) : (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Pick a question to preview.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Walkbook attachment picker — saves independently of the question
          set so it doesn't trigger the version-bump prompt. */}
      <section className="rounded-lg border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-navy-900">Walkbooks using this survey</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tick the walkbooks volunteers should run this survey on. Already-attached
              walkbooks are pre-checked. Saves independently of the question set.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={walkbookSearch}
              onChange={(e) => setWalkbookSearch(e.target.value)}
              placeholder="Search walkbooks"
              className="rounded border border-navy-200 px-2 py-1 text-xs"
            />
            <Button
              type="button"
              variant="accent"
              onClick={saveWalkbookAttachments}
              disabled={!walkbookDirty || walkbookSaving || !meta.id}
            >
              {walkbookSaving
                ? "Saving…"
                : walkbookDirty
                  ? `Save (${walkbookSelection.size} attached)`
                  : `Saved (${walkbookSelection.size} attached)`}
            </Button>
          </div>
        </div>

        {walkbookNotice ? (
          <p className="mb-2 rounded bg-emerald-100 px-3 py-2 text-xs text-emerald-800">
            {walkbookNotice}
          </p>
        ) : null}
        {walkbookError ? (
          <p className="mb-2 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">
            {walkbookError}
          </p>
        ) : null}

        {walkbooks.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No walkbooks in this district yet. Generate walkbooks at{" "}
            <Link href="/admin/walkbooks" className="underline">
              /admin/walkbooks
            </Link>{" "}
            first.
          </p>
        ) : filteredWalkbooks.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No walkbooks match &ldquo;{walkbookSearch}&rdquo;.
          </p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWalkbooks.map((w) => {
              const checked = walkbookSelection.has(w.id);
              return (
                <li key={w.id}>
                  <label
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition ${
                      checked
                        ? "border-navy-900 bg-navy-50"
                        : "border-border bg-white hover:border-navy-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWalkbook(w.id)}
                      className="flex-none"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy-900">{w.name}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {w.household_count} doors · {w.status}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function QuestionEditor({
  question,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
  onPatch,
}: {
  question: SurveyQuestionDraft;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onPatch: (p: Partial<SurveyQuestionDraft>) => void;
}) {
  const isChoice = question.question_type === "single_choice" || question.question_type === "multi_choice";
  const isScale = question.question_type === "rating_1_5" || question.question_type === "scale_0_10";
  const isInfo = question.question_type === "info";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy-900">
          {isInfo ? `Info screen ${question.order_index}` : `Question ${question.order_index}`}
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onMoveUp} disabled={!canMoveUp}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onMoveDown} disabled={!canMoveDown}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <label className="block text-xs">
        <span className="block font-medium text-navy-500">
          {isInfo ? "Internal label" : "Question text"}
        </span>
        <textarea
          value={question.question_text}
          onChange={(e) => onPatch({ question_text: e.target.value })}
          rows={isInfo ? 1 : 2}
          className="mt-1 w-full rounded-md border border-navy-200 p-2 text-sm"
        />
        {isInfo ? (
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Only shown in the editor list; not visible to the volunteer.
          </span>
        ) : null}
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs">
          <span className="block font-medium text-navy-500">
            {isInfo ? "Screen key" : "Question key"}
          </span>
          <Input
            value={question.question_key}
            onChange={(e) => onPatch({ question_key: toSlug(e.target.value) })}
          />
          <span className="mt-1 block text-[10px] text-muted-foreground">
            snake_case — must be unique in this survey
          </span>
        </label>

        <label className="block text-xs">
          <span className="block font-medium text-navy-500">Type</span>
          <select
            value={question.question_type}
            onChange={(e) => {
              const t = e.target.value as SurveyQuestionType;
              const next: Partial<SurveyQuestionDraft> = { question_type: t };
              if (t === "single_choice" || t === "multi_choice") {
                next.options = question.options ?? [
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ];
                next.min_value = null;
                next.max_value = null;
                next.body_html = null;
              } else if (t === "rating_1_5") {
                next.options = null;
                next.min_value = 1;
                next.max_value = 5;
                next.body_html = null;
              } else if (t === "scale_0_10") {
                next.options = null;
                next.min_value = 0;
                next.max_value = 10;
                next.body_html = null;
              } else if (t === "info") {
                next.options = null;
                next.min_value = null;
                next.max_value = null;
                next.required = false;
                next.body_html = question.body_html ?? "<p>Write the script or intro here.</p>";
              } else {
                next.options = null;
                next.min_value = null;
                next.max_value = null;
                next.body_html = null;
              }
              onPatch(next);
            }}
            className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
          >
            {(Object.keys(TYPE_LABELS) as SurveyQuestionType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isInfo ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-navy-500">Script body</p>
          <RichTextEditor
            value={question.body_html ?? ""}
            onChange={(html) => onPatch({ body_html: html })}
            minHeight={220}
          />
          <p className="text-[10px] text-muted-foreground">
            Rendered as read-only HTML to the volunteer with a Continue button.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onPatch({ required: e.target.checked })}
              />
              Required
            </label>
          </div>

          <label className="block text-xs">
            <span className="block font-medium text-navy-500">Help text</span>
            <Input
              value={question.help_text ?? ""}
              onChange={(e) => onPatch({ help_text: e.target.value || null })}
              placeholder="Optional hint shown under the question"
            />
          </label>

          {isChoice ? (
            <OptionsEditor
              options={question.options ?? []}
              onChange={(options) => onPatch({ options })}
            />
          ) : null}

          {isScale ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs">
                <span className="block font-medium text-navy-500">Min value</span>
                <input
                  type="number"
                  value={question.min_value ?? 0}
                  onChange={(e) => onPatch({ min_value: Number(e.target.value) })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="block font-medium text-navy-500">Max value</span>
                <input
                  type="number"
                  value={question.max_value ?? 10}
                  onChange={(e) => onPatch({ max_value: Number(e.target.value) })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
                />
              </label>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: SurveyOption[];
  onChange: (o: SurveyOption[]) => void;
}) {
  function patch(idx: number, p: Partial<SurveyOption>) {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...p } : o)));
  }
  function remove(idx: number) {
    onChange(options.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([
      ...options,
      { value: `option_${options.length + 1}`, label: `Option ${options.length + 1}` },
    ]);
  }
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">Options</p>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-full border border-navy-200 bg-white px-2 py-0.5 text-[11px] font-medium text-navy-700 hover:bg-navy-50"
        >
          <Plus className="h-3 w-3" /> Add option
        </button>
      </div>
      <ul className="mt-2 space-y-2">
        {options.map((o, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <Input
              value={o.label}
              onChange={(e) =>
                patch(i, {
                  label: e.target.value,
                  value: o.value || toSlug(e.target.value),
                })
              }
              placeholder="Label (what the voter sees)"
            />
            <Input
              value={o.value}
              onChange={(e) => patch(i, { value: toSlug(e.target.value) })}
              placeholder="value (stable key)"
            />
            <Button size="sm" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
        {options.length === 0 ? (
          <li className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            Add at least one option.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: SurveyMetaDraft["status"] }) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  if (status === "archived") return <Badge variant="secondary">Archived</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function BreakingChangesPrompt({
  diff,
  onForce,
  onCancel,
}: {
  diff: { breaking: string[]; nonBreaking: string[] };
  onForce: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
        <div className="space-y-2">
          <p className="font-semibold">This change alters the data structure.</p>
          <ul className="list-disc pl-5 text-xs">
            {diff.breaking.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <p className="text-xs">
            Saving anyway will bump the survey version on next publish. Existing responses keep
            their snapshot intact, so reporting is safe — but the live survey will change for
            knockers.
          </p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="accent" onClick={onForce}>
              Save anyway
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
