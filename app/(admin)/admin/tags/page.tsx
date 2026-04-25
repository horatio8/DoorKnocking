import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveDistrict, listScopedDistricts } from "@/lib/districts/active";
import { Badge } from "@/components/ui/badge";
import { PromoteTagButton } from "@/components/admin/promote-tag-button";

export const dynamic = "force-dynamic";

// Same role-gated service-role pattern as the rest of the migrated
// admin pages — RLS bypass is safe because the role check above is the
// gatekeeper. Scope follows the global ClientSwitcher / DistrictSwitcher.
export default async function AdminTags() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }
  const supabase = getSupabaseServiceRoleClient();
  const [pinnedDistrict, scopedDistricts] = await Promise.all([
    getActiveDistrict(),
    listScopedDistricts(),
  ]);
  const effectiveDistricts = pinnedDistrict
    ? scopedDistricts.filter((d) => d.id === pinnedDistrict.id)
    : scopedDistricts;
  const districtIds = effectiveDistricts.map((d) => d.id);
  const districtNameById = new Map(effectiveDistricts.map((d) => [d.id, d.name]));

  const { data } = districtIds.length > 0
    ? await supabase
        .from("tags")
        .select("id, label, is_standard, usage_count, district_id")
        .in("district_id", districtIds)
        .order("usage_count", { ascending: false })
    : { data: [] as Array<{ id: string; label: string; is_standard: boolean; usage_count: number; district_id: string }> };
  const rows = (data ?? []) as Array<{
    id: string;
    label: string;
    is_standard: boolean;
    usage_count: number;
    district_id: string;
  }>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Tags</h1>
        <p className="text-sm text-muted-foreground">
          Standard tags come from admins; ad-hoc tags come from the field. Promote the ones worth keeping.
          {effectiveDistricts.length > 1
            ? ` Across ${effectiveDistricts.length} districts.`
            : effectiveDistricts.length === 1
              ? ` Scoped to ${effectiveDistricts[0].name}.`
              : " No districts in scope."}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">Type</th>
              {effectiveDistricts.length > 1 ? (
                <th className="px-3 py-2 text-left">District</th>
              ) : null}
              <th className="px-3 py-2 text-right">Usage</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{t.label}</td>
                <td className="px-3 py-2">
                  {t.is_standard ? <Badge variant="success">Standard</Badge> : <Badge variant="secondary">Ad hoc</Badge>}
                </td>
                {effectiveDistricts.length > 1 ? (
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {districtNameById.get(t.district_id) ?? "—"}
                  </td>
                ) : null}
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
