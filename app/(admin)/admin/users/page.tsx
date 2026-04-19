import { redirect } from "next/navigation";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { Badge } from "@/components/ui/badge";
import { UsersActionsArea } from "@/components/admin/users-actions-area";
import { UserRowActions } from "@/components/admin/user-row-actions";

export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }
  const supabase = getSupabaseServiceRoleClient();
  const activeClient = await getActiveClient();

  // Districts under the active client — used for the invite form + display.
  const { data: districtRows } = activeClient
    ? await supabase.from("districts").select("id, name").eq("client_id", activeClient.id)
    : session.district?.id
      ? await supabase.from("districts").select("id, name").eq("id", session.district.id)
      : { data: [] as Array<{ id: string; name: string }> };
  const districts = (districtRows ?? []) as Array<{ id: string; name: string }>;

  // Users list — filtered to the active client when one is set. Super-admins
  // on the apex without a picked client see everyone so onboarding of new
  // super-admins still works.
  let userRows: Array<{
    id: string;
    full_name: string | null;
    email: string;
    role: string;
    active: boolean;
    last_seen_at: string | null;
    availability: string | null;
    total_time_budget_minutes: number | null;
    speed_rating: string | null;
    default_district_id: string | null;
  }> = [];
  if (activeClient) {
    const { data } = await supabase
      .from("users")
      .select(
        "id, full_name, email, role, active, last_seen_at, availability, total_time_budget_minutes, speed_rating, default_district_id, client_access",
      )
      .contains("client_access", [activeClient.id])
      .order("created_at", { ascending: false });
    userRows = ((data ?? []) as Array<typeof userRows[number] & { client_access: string[] | null }>)
      .map(({ client_access: _drop, ...rest }) => rest);
  } else {
    const { data } = await supabase
      .from("users")
      .select(
        "id, full_name, email, role, active, last_seen_at, availability, total_time_budget_minutes, speed_rating, default_district_id",
      )
      .order("created_at", { ascending: false });
    userRows = (data ?? []) as typeof userRows;
  }

  // Active load per knocker (walkbooks currently assigned, still open).
  const knockerIds = userRows.filter((u) => u.role === "knocker").map((u) => u.id);
  const loadByUser = new Map<string, { minutes: number; count: number }>();
  if (knockerIds.length > 0) {
    const { data: assigns } = await supabase
      .from("walkbook_assignments")
      .select(
        "user_id, walkbooks(status, estimated_duration_minutes, target_duration_minutes)",
      )
      .in("user_id", knockerIds)
      .is("unassigned_at", null);
    for (const a of (assigns ?? []) as Array<{
      user_id: string;
      walkbooks:
        | { status: string; estimated_duration_minutes: number | null; target_duration_minutes: number | null }
        | Array<{ status: string; estimated_duration_minutes: number | null; target_duration_minutes: number | null }>
        | null;
    }>) {
      const w = Array.isArray(a.walkbooks) ? a.walkbooks[0] : a.walkbooks;
      if (!w || w.status === "complete") continue;
      const entry = loadByUser.get(a.user_id) ?? { minutes: 0, count: 0 };
      entry.minutes += w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0;
      entry.count += 1;
      loadByUser.set(a.user_id, entry);
    }
  }

  const districtNameById = new Map(districts.map((d) => [d.id, d.name]));

  function hm(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  return (
    <div className="space-y-6">
      <UsersActionsArea
        clientId={activeClient?.id ?? null}
        clientName={activeClient?.name ?? null}
        districts={districts}
        defaultDistrictId={session.district?.id ?? districts[0]?.id ?? null}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">District</th>
              <th className="px-3 py-2 text-left">Pace</th>
              <th className="px-3 py-2 text-left">Budget</th>
              <th className="px-3 py-2 text-left">Load</th>
              <th className="px-3 py-2 text-left">Availability</th>
              <th className="px-3 py-2 text-left">Last seen</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {userRows.map((u) => {
              const load = u.role === "knocker" ? loadByUser.get(u.id) ?? { minutes: 0, count: 0 } : null;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {u.full_name ?? "—"} {!u.active ? <Badge variant="secondary">Inactive</Badge> : null}
                  </td>
                  <td className="px-3 py-2 text-xs">{u.email}</td>
                  <td className="px-3 py-2 capitalize">{u.role.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.default_district_id
                      ? districtNameById.get(u.default_district_id) ?? "—"
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">
                    {u.role === "knocker" ? u.speed_rating ?? "medium" : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {u.role === "knocker"
                      ? hm(u.total_time_budget_minutes ?? 480)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {load
                      ? `${hm(load.minutes)} · ${load.count} walkbook${load.count === 1 ? "" : "s"}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {u.availability === "available" ? (
                      <Badge variant="success">Available</Badge>
                    ) : u.availability === "out_in_field" ? (
                      <Badge variant="warning">In field</Badge>
                    ) : u.availability === "unavailable" ? (
                      <Badge variant="secondary">Unavailable</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <UserRowActions
                      user={{
                        id: u.id,
                        full_name: u.full_name,
                        email: u.email,
                        role: u.role,
                        active: u.active,
                        availability: u.availability,
                        total_time_budget_minutes: u.total_time_budget_minutes,
                        speed_rating: u.speed_rating,
                        default_district_id: u.default_district_id,
                      }}
                      districts={districts}
                      clientId={activeClient?.id ?? null}
                    />
                  </td>
                </tr>
              );
            })}
            {userRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No users yet for this client.{" "}
                  <Link href="#invite" className="underline">
                    Invite your first knocker
                  </Link>
                  .
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
