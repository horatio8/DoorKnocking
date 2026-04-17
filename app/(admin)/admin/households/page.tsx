import { redirect } from "next/navigation";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { HOUSEHOLD_STATUS_LABELS, type HouseholdStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminHouseholds() {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("households")
    .select("*")
    .eq("district_id", session.district?.id ?? "")
    .order("address_line1")
    .limit(200);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Households</h1>
        <p className="text-sm text-muted-foreground">
          Showing first 200. Use the field map or export for the full list.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">Address</th>
              <th className="px-3 py-2 text-left">City</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((h: {
              id: string;
              address_line1: string;
              city: string | null;
              status: HouseholdStatus;
            }) => (
              <tr key={h.id} className="border-t border-border">
                <td className="px-3 py-2">{h.address_line1}</td>
                <td className="px-3 py-2">{h.city ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant="secondary">{HOUSEHOLD_STATUS_LABELS[h.status]}</Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/app/household/${h.id}`} className="text-xs text-navy-700 underline">
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
