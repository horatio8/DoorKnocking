import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminSurveys() {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("surveys")
    .select("*, survey_questions(id)")
    .eq("district_id", session.district?.id ?? "")
    .order("priority", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Surveys</h1>
          <p className="text-sm text-muted-foreground">
            Authored in Airtable or in the editor. Only active surveys reach the field.
          </p>
        </div>
        <Link href="/admin/surveys/new">
          <Button variant="accent">New survey</Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Questions</th>
              <th className="px-3 py-2 text-left">Visibility</th>
              <th className="px-3 py-2 text-left">Priority</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((s: {
              id: string;
              name: string;
              visibility: string;
              priority: number;
              active: boolean;
              survey_questions?: { id: string }[];
            }) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link href={`/admin/surveys/${s.id}`} className="text-navy-900 underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{s.survey_questions?.length ?? 0}</td>
                <td className="px-3 py-2 capitalize">{s.visibility.replace("_", " ")}</td>
                <td className="px-3 py-2">{s.priority}</td>
                <td className="px-3 py-2">
                  {s.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
