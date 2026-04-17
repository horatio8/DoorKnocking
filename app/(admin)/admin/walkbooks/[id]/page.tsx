import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function WalkbookDetail({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();

  const { data: walkbook } = await supabase
    .from("walkbooks")
    .select("*, walkbook_households(order_index, households(id, address_line1, status))")
    .eq("id", params.id)
    .maybeSingle();
  if (!walkbook) notFound();

  const rows = ((walkbook as { walkbook_households?: Array<{ order_index: number; households: { id: string; address_line1: string; status: string } | null }> }).walkbook_households ?? [])
    .map((r) => ({ order: r.order_index, ...r.households }))
    .filter((r) => r.id);

  return (
    <div className="space-y-5">
      <Link href="/admin/walkbooks" className="inline-flex items-center gap-1 text-sm text-navy-700">
        <ArrowLeft className="h-4 w-4" /> All walkbooks
      </Link>
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">
          {(walkbook as { name: string }).name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} households · {(walkbook as { status: string }).status}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Households in walk order</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex justify-between border-b border-border py-1">
                <span>
                  <span className="mr-2 text-xs text-muted-foreground">#{r.order + 1}</span>
                  {r.address_line1}
                </span>
                <span className="text-muted-foreground">{r.status}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
