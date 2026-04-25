import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveDistrict, listScopedDistricts } from "@/lib/districts/active";
import { BatchesList } from "@/components/admin/batches-list";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/admin");
  }

  const supabase = getSupabaseServiceRoleClient();
  const [pinnedDistrict, scopedDistricts] = await Promise.all([
    getActiveDistrict(),
    listScopedDistricts(),
  ]);
  const districts = pinnedDistrict
    ? scopedDistricts.filter((d) => d.id === pinnedDistrict.id)
    : scopedDistricts;
  const districtIds = districts.map((d) => d.id);
  const districtNameById = new Map(districts.map((d) => [d.id, d.name]));

  const { data: batches } = districtIds.length > 0
    ? await supabase
        .from("assignment_batches")
        .select("*, users:users!assignment_batches_created_by_fkey(full_name)")
        .in("district_id", districtIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as Array<Record<string, unknown>> };

  type BatchRow = {
    id: string;
    district_id: string;
    method: string;
    walkbook_count: number;
    volunteer_count: number;
    total_duration_minutes: number;
    total_doors: number;
    notes: string | null;
    undone_at: string | null;
    created_at: string;
    users: { full_name?: string } | Array<{ full_name?: string }> | null;
  };

  const rows = ((batches ?? []) as BatchRow[]).map((b) => {
    const u = Array.isArray(b.users) ? b.users[0] : b.users;
    return {
      id: b.id,
      district: districtNameById.get(b.district_id) ?? "—",
      method: b.method,
      walkbookCount: b.walkbook_count,
      volunteerCount: b.volunteer_count,
      totalDurationMinutes: b.total_duration_minutes,
      totalDoors: b.total_doors,
      notes: b.notes,
      undoneAt: b.undone_at,
      createdAt: b.created_at,
      createdAtRelative: formatRelative(b.created_at),
      createdBy: u?.full_name ?? null,
    };
  });

  return (
    <div className="space-y-5">
      <Link href="/admin/walkbooks" className="inline-flex items-center gap-1 text-sm text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Walkbooks
      </Link>
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Assignment batches</h1>
        <p className="text-sm text-muted-foreground">
          Every "Confirm & Notify" click becomes a batch. Undo reverts all assignments in the
          batch — blocked if any knock events have landed since.
        </p>
      </div>
      <BatchesList batches={rows} />
    </div>
  );
}
