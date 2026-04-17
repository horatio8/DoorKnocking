import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { PromoteTagButton } from "@/components/admin/promote-tag-button";

export const dynamic = "force-dynamic";

export default async function AdminTags() {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("tags")
    .select("*")
    .eq("district_id", session.district?.id ?? "")
    .order("usage_count", { ascending: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Tags</h1>
        <p className="text-sm text-muted-foreground">
          Standard tags come from admins; ad-hoc tags come from the field. Promote the ones worth keeping.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Usage</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((t: {
              id: string;
              label: string;
              is_standard: boolean;
              usage_count: number;
            }) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{t.label}</td>
                <td className="px-3 py-2">
                  {t.is_standard ? <Badge variant="success">Standard</Badge> : <Badge variant="secondary">Ad hoc</Badge>}
                </td>
                <td className="px-3 py-2 text-right">{t.usage_count}</td>
                <td className="px-3 py-2 text-right">
                  {t.is_standard ? null : <PromoteTagButton tagId={t.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
