import { redirect } from "next/navigation";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateWalkbooksButton } from "@/components/admin/generate-walkbooks-button";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminWalkbooks() {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();
  const districtId = session.district?.id;

  const { data: walkbooks } = await supabase
    .from("walkbooks")
    .select("*, walkbook_assignments(user_id, users(full_name), unassigned_at)")
    .eq("district_id", districtId ?? "")
    .order("created_at", { ascending: false });

  // Efficiency metrics: doors/hour and completion per walkbook. Pull once,
  // map in memory — keeps the page simple and still correct at this scale.
  const wbIds = ((walkbooks ?? []) as Array<{ id: string }>).map((w) => w.id);
  let knocksByWalkbook = new Map<string, Array<{ household_id: string; duration_seconds: number | null }>>();
  if (wbIds.length > 0) {
    const { data: events } = await supabase
      .from("knock_events")
      .select("walkbook_id, household_id, duration_seconds")
      .in("walkbook_id", wbIds);
    for (const e of (events ?? []) as Array<{ walkbook_id: string; household_id: string; duration_seconds: number | null }>) {
      const list = knocksByWalkbook.get(e.walkbook_id) ?? [];
      list.push({ household_id: e.household_id, duration_seconds: e.duration_seconds });
      knocksByWalkbook.set(e.walkbook_id, list);
    }
  }
  function metrics(wbId: string, householdCount: number) {
    const events = knocksByWalkbook.get(wbId) ?? [];
    const distinctHouseholds = new Set(events.map((e) => e.household_id));
    const totalSeconds = events
      .map((e) => e.duration_seconds)
      .filter((s): s is number => typeof s === "number" && s > 0)
      .reduce((a, b) => a + b, 0);
    const hours = totalSeconds / 3600;
    const doorsPerHour = hours > 0 ? distinctHouseholds.size / hours : null;
    const completion = householdCount > 0 ? distinctHouseholds.size / householdCount : 0;
    return { doorsPerHour, completion, knocks: events.length };
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Walkbooks</h1>
          <p className="text-sm text-muted-foreground">
            Geographic clusters of households assigned as a single unit of work.
          </p>
        </div>
        {districtId ? <GenerateWalkbooksButton districtId={districtId} /> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {((walkbooks ?? []) as unknown as Array<{
          id: string;
          name: string;
          household_count: number;
          status: string;
          created_at: string;
          walkbook_assignments?: Array<{
            unassigned_at: string | null;
            users?: { full_name?: string } | Array<{ full_name?: string }> | null;
          }>;
        }>).map((wb) => {
          const assignment = wb.walkbook_assignments?.find((a) => a.unassigned_at === null);
          const assignedUser = Array.isArray(assignment?.users) ? assignment?.users[0] : assignment?.users;
          return (
            <Link key={wb.id} href={`/admin/walkbooks/${wb.id}`}>
              <Card className="transition hover:border-navy-100">
                <CardHeader>
                  <CardTitle>{wb.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>{wb.household_count} households · {wb.status}</p>
                  {(() => {
                    const m = metrics(wb.id, wb.household_count);
                    return (
                      <p className="text-xs">
                        {Math.round(m.completion * 100)}% complete
                        {m.doorsPerHour != null ? ` · ${m.doorsPerHour.toFixed(1)} doors/hr` : ""}
                        {m.knocks > 0 ? ` · ${m.knocks} knocks` : ""}
                      </p>
                    );
                  })()}
                  <p className="mt-1">
                    {assignedUser?.full_name
                      ? `Assigned to ${assignedUser.full_name}`
                      : "Unassigned"}
                  </p>
                  <p className="text-xs">Created {formatRelative(wb.created_at)}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {(walkbooks ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            No walkbooks yet. Click “Auto-generate walkbooks” above to create them from current households.
          </p>
        ) : null}
      </div>
    </div>
  );
}
