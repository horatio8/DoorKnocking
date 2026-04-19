"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";
import { enqueue } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import type { Survey, SurveyQuestion, Voter } from "@/lib/types";

interface Props {
  knockEventId: string;
  voter: Voter;
  survey: Survey & { survey_questions: SurveyQuestion[] };
  initialAnswers?: Record<string, unknown>;
}

type Answer = string | string[] | number | boolean | null;

export function SurveyRunner({ knockEventId, voter, survey, initialAnswers }: Props) {
  const router = useRouter();
  const questions = useMemo(
    () => [...survey.survey_questions].sort((a, b) => a.order_index - b.order_index),
    [survey.survey_questions],
  );
  // Resume support — server-loaded prior answers seed local state, and the
  // cursor jumps to the first unanswered question on mount.
  const seeded: Record<string, Answer> = useMemo(() => {
    const out: Record<string, Answer> = {};
    if (!initialAnswers) return out;
    for (const [k, v] of Object.entries(initialAnswers)) out[k] = v as Answer;
    return out;
  }, [initialAnswers]);
  const [index, setIndex] = useState(() => {
    const firstUnanswered = questions.findIndex((q) => isEmpty(seeded[q.id] ?? null));
    return firstUnanswered === -1 ? 0 : firstUnanswered;
  });
  const [answers, setAnswers] = useState<Record<string, Answer>>(seeded);
  const [submitting, setSubmitting] = useState(false);

  const current = questions[index];
  const total = questions.length;
  const answered = current ? answers[current.id] : null;
  const canAdvance = current ? !current.required || !isEmpty(answered) : false;

  async function persist(questionId: string, answer: Answer, partial = true) {
    // Best-effort direct push to Supabase; outbox enqueue is the offline
    // fallback so the answer survives a connection dropout.
    try {
      const res = await fetch("/api/knocker/survey-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knock_event_id: knockEventId,
          voter_id: voter.id,
          survey_id: survey.id,
          question_id: questionId,
          answer,
          partial,
        }),
        keepalive: true,
      });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch {
      await enqueue({
        id: uuid(),
        endpoint: "survey_response",
        payload: {
          knock_event_id: knockEventId,
          voter_id: voter.id,
          survey_id: survey.id,
          question_id: questionId,
          answer,
          partial,
        },
      });
    }
  }

  function setAnswer(value: Answer) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
  }

  async function handleSkip() {
    if (!current || current.required) return;
    if (index + 1 >= total) {
      await finish(true);
    } else {
      setIndex(index + 1);
    }
  }

  async function handleNext() {
    if (!current || !canAdvance) return;
    await persist(current.id, answers[current.id] ?? null, true);
    if (index + 1 >= total) {
      await finish(true);
    } else {
      setIndex(index + 1);
    }
  }

  async function finish(complete: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/knocker/survey-response", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knock_event_id: knockEventId, complete }),
        keepalive: true,
      });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch {
      await enqueue({
        id: uuid(),
        endpoint: "knock_event",
        payload: {
          id: knockEventId,
          client_event_id: knockEventId,
          survey_completed: complete,
          survey_partial: !complete,
        },
      });
    }
    router.push("/app/map");
    router.refresh();
  }

  if (!current) {
    return (
      <div className="p-6 text-center text-muted-foreground">No questions configured.</div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-white px-4 py-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{survey.name}</p>
        <p className="font-voter text-lg font-semibold text-navy-900">{voter.display_name}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-50">
          <div
            className="h-full bg-crimson transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Question {index + 1} of {total}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-xl font-semibold text-navy-900">{current.question_text}</h2>
        {current.help_text ? (
          <p className="mt-1 text-sm text-muted-foreground">{current.help_text}</p>
        ) : null}
        <div className="mt-5">
          <QuestionInput question={current} value={answered} onChange={setAnswer} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-white p-4">
        <Button
          variant="outline"
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0 || submitting}
        >
          Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => finish(false)} disabled={submitting}>
            Save &amp; exit
          </Button>
          {!current.required ? (
            <Button variant="ghost" onClick={handleSkip} disabled={submitting}>
              Skip
            </Button>
          ) : null}
          <Button onClick={handleNext} disabled={!canAdvance || submitting} variant="accent">
            {index + 1 === total ? "Finish" : "Next →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: Answer;
  onChange(v: Answer): void;
}) {
  switch (question.question_type) {
    case "single_choice":
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`block w-full rounded-lg border px-4 py-3 text-left text-sm ${
                value === o.value ? "border-navy bg-navy-50" : "border-border bg-white"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    case "multi_choice": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((o) => {
            const active = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  onChange(active ? arr.filter((v) => v !== o.value) : [...arr, o.value])
                }
                className={`block w-full rounded-lg border px-4 py-3 text-left text-sm ${
                  active ? "border-navy bg-navy-50" : "border-border bg-white"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "short_text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input px-3 py-2"
        />
      );
    case "long_text":
      return (
        <textarea
          rows={5}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input px-3 py-2"
        />
      );
    case "yes_no":
      return (
        <div className="flex gap-2">
          {[
            { value: true, label: "Yes" },
            { value: false, label: "No" },
          ].map((o) => (
            <button
              key={String(o.value)}
              onClick={() => onChange(o.value)}
              className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium ${
                value === o.value ? "border-navy bg-navy text-white" : "border-border bg-white text-navy-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    case "rating_1_5":
      return <Scale value={typeof value === "number" ? value : null} onChange={onChange} min={1} max={5} />;
    case "scale_0_10":
      return <Scale value={typeof value === "number" ? value : null} onChange={onChange} min={0} max={10} />;
  }
}

function Scale({
  value,
  onChange,
  min,
  max,
}: {
  value: number | null;
  onChange(v: Answer): void;
  min: number;
  max: number;
}) {
  const range = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return (
    <div className="flex flex-wrap gap-2">
      {range.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`h-11 w-11 rounded-md border text-sm font-semibold ${
            value === n ? "border-navy bg-navy text-white" : "border-border bg-white text-navy-700"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function isEmpty(v: Answer): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}
