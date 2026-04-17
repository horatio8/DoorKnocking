import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function KnockerWalkbooks() {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("walkbook_assignments")
    .select("walkbook_id, walkbooks(*)")
    .eq("user_id", session.user.id)
    .is("unassigned_at", null);

  const items = (data ?? [])
    .map((d: unknown) => (d as { walkbooks: { id: string; name: string; status: string; household_count: number } }).walkbooks)
    .filter(Boolean);

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="font-serif text-2xl font-semibold text-navy-900">My walkbooks</h1>
      <p className="text-sm text-muted-foreground">
        Assigned clusters of houses. Tap a walkbook to focus the map.
      </p>
      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No walkbook assigned yet. Ask your admin, or start knocking from the map.
          </p>
        ) : (
          items.map((w) => (
            <Link key={w.id} href={`/app/map?walkbook=${w.id}`}>
              <Card className="hover:border-navy-100">
                <CardHeader>
                  <CardTitle>{w.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {w.household_count} households · {w.status}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
