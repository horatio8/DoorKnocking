import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import type { Survey, SurveyQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SurveyDetail({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();

  const { data: survey } = await supabase
    .from("surveys")
    .select("*, survey_questions(*)")
    .eq("id", params.id)
    .maybeSingle();
  if (!survey) notFound();
  const s = survey as Survey & { survey_questions: SurveyQuestion[] };
  const questions = [...s.survey_questions].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="space-y-5">
      <Link href="/admin/surveys" className="inline-flex items-center gap-1 text-sm text-navy-700">
        <ArrowLeft className="h-4 w-4" /> All surveys
      </Link>
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">{s.name}</h1>
        <p className="text-sm text-muted-foreground">{s.description ?? ""}</p>
        <div className="mt-2 flex gap-2">
          <Badge variant={s.active ? "success" : "secondary"}>
            {s.active ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="secondary">Priority {s.priority}</Badge>
          <Badge variant="secondary">{s.visibility.replace("_", " ")}</Badge>
        </div>
      </div>

      <ol className="space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="rounded-md border border-border bg-white p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Question {q.order_index + 1} · {q.question_type.replace("_", " ")}
              {q.required ? " · required" : ""}
            </p>
            <p className="mt-1 text-navy-900">{q.question_text}</p>
            {q.options && q.options.length > 0 ? (
              <ul className="mt-2 text-sm text-muted-foreground">
                {q.options.map((o) => (
                  <li key={o.value}>— {o.label}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
        {questions.length === 0 ? (
          <li className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            No questions yet. Author in Airtable or extend the admin UI.
          </li>
        ) : null}
      </ol>
    </div>
  );
}
