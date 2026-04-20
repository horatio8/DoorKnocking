import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WalkbookRouteMap,
  type RouteStop,
} from "@/components/admin/walkbook-route-map";
import { formatWalkbookName } from "@/lib/walkbooks/display-name";

export const dynamic = "force-dynamic";

export default async function WalkbookDetail({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }
  const supabase = getSupabaseServiceRoleClient();

  const { data: walkbook } = await supabase
    .from("walkbooks")
    .select(
      "id, name, status, household_count, estimated_duration_minutes, target_duration_minutes, kind",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!walkbook) notFound();
  const wb = walkbook as {
    id: string;
    name: string;
    status: string;
    household_count: number;
    estimated_duration_minutes: number | null;
    target_duration_minutes: number | null;
    kind: string;
  };

  // Two-step fetch: walkbook_households then households (avoids the nested-
  // join bug that bites on the index page).
  const { data: stopRows } = await supabase
    .from("walkbook_households")
    .select("order_index, household_id")
    .eq("walkbook_id", params.id)
    .order("order_index");
  const ordered = (stopRows ?? []) as Array<{ order_index: number; household_id: string }>;
  const hhIds = ordered.map((r) => r.household_id);

  const { data: hhRows } = hhIds.length
    ? await supabase
        .from("households")
        .select("id, address_line1, city, status, lat, lng")
        .in("id", hhIds)
    : { data: [] as Array<{ id: string; address_line1: string; city: string | null; status: string; lat: number | null; lng: number | null }> };
  const hhById = new Map(
    ((hhRows ?? []) as Array<{
      id: string;
      address_line1: string;
      city: string | null;
      status: string;
      lat: number | null;
      lng: number | null;
    }>).map((h) => [h.id, h]),
  );

  const stops: RouteStop[] = ordered.flatMap((r) => {
    const h = hhById.get(r.household_id);
    if (!h || h.lat == null || h.lng == null) return [];
    return [
      {
        id: h.id,
        lat: Number(h.lat),
        lng: Number(h.lng),
        address: [h.address_line1, h.city].filter(Boolean).join(", "),
        status: h.status,
      },
    ];
  });

  const est = wb.estimated_duration_minutes ?? wb.target_duration_minutes;

  return (
    <div className="space-y-5">
      <Link href="/admin/walkbooks" className="inline-flex items-center gap-1 text-sm text-navy-700">
        <ArrowLeft className="h-4 w-4" /> All walkbooks
      </Link>

      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">
          {formatWalkbookName(wb.name)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {wb.household_count} households · {wb.status}
          {est ? ` · est ${est}m` : ""}
        </p>
      </div>

      <WalkbookRouteMap walkbookId={wb.id} stops={stops} />

      <Card>
        <CardHeader>
          <CardTitle>Households in walk order</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1 text-sm">
            {ordered.map((r, i) => {
              const h = hhById.get(r.household_id);
              if (!h) return null;
              return (
                <li
                  key={r.household_id}
                  className="flex justify-between border-b border-border py-1"
                >
                  <span>
                    <span className="mr-2 text-xs font-mono text-muted-foreground">
                      #{i + 1}
                    </span>
                    {h.address_line1}
                    {h.city ? `, ${h.city}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{h.status}</span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
