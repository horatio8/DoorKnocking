import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CreateDistrictForm } from "@/components/admin/create-district-form";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminDistricts() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "super_admin") redirect("/admin");

  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("districts").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Districts</h1>
          <p className="text-sm text-muted-foreground">
            Every district has its own Airtable base and a fully isolated voter universe.
          </p>
        </div>
        <CreateDistrictForm />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">Slug</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Country / region</th>
              <th className="px-3 py-2 text-left">Airtable base</th>
              <th className="px-3 py-2 text-left">Walkbook size</th>
              <th className="px-3 py-2 text-left">Active</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((d: {
              id: string;
              slug: string;
              name: string;
              country: string;
              region: string;
              airtable_base_id: string | null;
              default_walkbook_size: number;
              active: boolean;
            }) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{d.slug}</td>
                <td className="px-3 py-2">{d.name}</td>
                <td className="px-3 py-2">{d.country} · {d.region}</td>
                <td className="px-3 py-2 font-mono text-xs">{d.airtable_base_id ?? "—"}</td>
                <td className="px-3 py-2">{d.default_walkbook_size}</td>
                <td className="px-3 py-2">
                  {d.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Paused</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
