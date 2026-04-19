"use client";

import type { SurveyQuestionDraft } from "@/lib/surveys/types";

// Renders a question roughly how it will appear on a knocker's phone.
// Deliberately read-only — buttons don't do anything, values don't persist.

export function SurveyQuestionPreview({
  question,
  index,
  total,
}: {
  question: SurveyQuestionDraft;
  index: number;
  total: number;
}) {
  return (
    <div className="space-y-3 p-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-navy-500">
        <span>
          {index + 1} / {total}
        </span>
        <span>{question.required ? "Required" : "Optional"}</span>
      </div>
      <div className="h-1.5 rounded-full bg-navy-100">
        <div
          className="h-full rounded-full bg-navy-900"
          style={{ width: `${((index + 1) / Math.max(total, 1)) * 100}%` }}
        />
      </div>
      <p className="text-sm font-semibold text-navy-900">
        {question.question_text || "…"}
      </p>
      {question.help_text ? (
        <p className="text-[11px] text-muted-foreground">{question.help_text}</p>
      ) : null}
      <PreviewBody question={question} />
      <div className="flex items-center justify-between pt-1 text-[10px]">
        <span className="text-muted-foreground">Skip</span>
        <span className="rounded-full bg-navy-900 px-3 py-1 text-white">Next →</span>
      </div>
    </div>
  );
}

function PreviewBody({ question }: { question: SurveyQuestionDraft }) {
  if (question.question_type === "single_choice" || question.question_type === "multi_choice") {
    return (
      <ul className="space-y-1.5">
        {(question.options ?? []).map((o) => (
          <li
            key={o.value}
            className="rounded-md border border-navy-200 bg-white px-2 py-1.5 text-xs text-navy-900"
          >
            <span className="mr-2 inline-block h-3 w-3 rounded-full border border-navy-400 align-middle" />
            {o.label || o.value}
          </li>
        ))}
        {(question.options ?? []).length === 0 ? (
          <li className="text-xs text-muted-foreground">(add options on the left)</li>
        ) : null}
      </ul>
    );
  }
  if (question.question_type === "yes_no") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <span className="rounded-md border border-navy-200 px-3 py-2 text-center text-sm">Yes</span>
        <span className="rounded-md border border-navy-200 px-3 py-2 text-center text-sm">No</span>
      </div>
    );
  }
  if (question.question_type === "short_text") {
    return (
      <div className="rounded-md border border-navy-200 px-2 py-1.5 text-xs text-muted-foreground">
        Type their answer…
      </div>
    );
  }
  if (question.question_type === "long_text") {
    return (
      <div className="h-16 rounded-md border border-navy-200 px-2 py-1.5 text-xs text-muted-foreground">
        Longer notes…
      </div>
    );
  }
  if (question.question_type === "rating_1_5") {
    return (
      <div className="flex justify-between gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className="flex-1 rounded-md border border-navy-200 py-2 text-center text-xs"
          >
            {n}
          </span>
        ))}
      </div>
    );
  }
  if (question.question_type === "scale_0_10") {
    const min = question.min_value ?? 0;
    const max = question.max_value ?? 10;
    const vals = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div className="flex flex-wrap gap-1">
        {vals.map((n) => (
          <span
            key={n}
            className="min-w-[28px] rounded-md border border-navy-200 px-1 py-1 text-center text-[11px]"
          >
            {n}
          </span>
        ))}
      </div>
    );
  }
  return null;
}
