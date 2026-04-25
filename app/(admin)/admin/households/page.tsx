import { redirect } from "next/navigation";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveDistrict, listScopedDistricts } from "@/lib/districts/active";
import { Badge } from "@/components/ui/badge";
import { HOUSEHOLD_STATUS_LABELS, type HouseholdStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 200;

// Cross-scope household browser. Service-role client (RLS bypass) is
// safe because the role check above is the gatekeeper, mirroring the
// pattern in /admin/airtable/diagnose. Scope is driven by the global
// DistrictSwitcher / ClientSwitcher in the admin header — when no
// district is pinned, the page shows everything in scope (active
// client's districts, or all of the admin's accessible districts).
export default async function AdminHouseholds() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }
  const supabase = getSupabaseServiceRoleClient();

  const [activeDistrict, scopedDistricts] = await Promise.all([
    getActiveDistrict(),
    listScopedDistricts(),
  ]);

  const effectiveDistricts = activeDistrict
    ? [activeDistrict]
    : scopedDistricts;
  const districtIds = effectiveDistricts.map((d) => d.id);

  if (districtIds.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          activeDistrict={activeDistrict}
          scopeSize={scopedDistricts.length}
          totalRows={0}
          shownRows={0}
        />
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
          No districts in scope. Pick an active client up top, or have a
          super_admin grant district access on /admin/users.
        </div>
      </div>
    );
  }

  const { data: rows, count: total } = await supabase
    .from("households")
    .select(
      "id, address_line1, unit, city, state, zip, lat, lng, status, district_id",
      { count: "exact" },
    )
    .in("district_id", districtIds)
    .order("address_line1")
    .limit(PAGE_LIMIT);

  const districtNameById = new Map(effectiveDistricts.map((d) => [d.id, d.name]));
  const households = (rows ?? []) as Array<{
    id: string;
    address_line1: string;
    unit: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    lat: number | null;
    lng: number | null;
    status: HouseholdStatus;
    district_id: string;
  }>;

  return (
    <div className="space-y-5">
      <PageHeader
        activeDistrict={activeDistrict}
        scopeSize={scopedDistricts.length}
        totalRows={total ?? 0}
        shownRows={households.length}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">Address</th>
              <th className="px-3 py-2 text-left">City</th>
              {effectiveDistricts.length > 1 ? (
                <th className="px-3 py-2 text-left">District</th>
              ) : null}
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {households.map((h) => (
              <tr key={h.id} className="border-t border-border">
                <td className="px-3 py-2">
                  {h.address_line1}
                  {h.unit ? <span className="text-muted-foreground"> · {h.unit}</span> : null}
                </td>
                <td className="px-3 py-2">{h.city ?? "—"}</td>
                {effectiveDistricts.length > 1 ? (
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {districtNameById.get(h.district_id) ?? "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  <Badge variant="secondary">{HOUSEHOLD_STATUS_LABELS[h.status]}</Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/app/household/${h.id}`}
                    className="text-xs text-navy-700 underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageHeader({
  activeDistrict,
  scopeSize,
  totalRows,
  shownRows,
}: {
  activeDistrict: { id: string; name: string } | null;
  scopeSize: number;
  totalRows: number;
  shownRows: number;
}) {
  const scopeLabel = activeDistrict
    ? `Scoped to ${activeDistrict.name}.`
    : scopeSize === 0
      ? "No districts in scope."
      : scopeSize === 1
        ? "Scoped to 1 district."
        : `Across ${scopeSize} districts.`;
  return (
    <div className="space-y-1">
      <h1 className="font-serif text-2xl font-semibold text-navy-900">Households</h1>
      <p className="text-sm text-muted-foreground">
        {scopeLabel} {totalRows.toLocaleString()} total · showing{" "}
        {shownRows.toLocaleString()}
        {totalRows > shownRows ? ` (capped at ${PAGE_LIMIT})` : ""}.
        {scopeSize > 1 ? " Use the District switcher up top to focus on one." : ""}
      </p>
    </div>
  );
}
