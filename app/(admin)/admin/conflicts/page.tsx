import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminConflicts() {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("sync_conflicts")
    .select("*")
    .eq("resolution", "unresolved")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Conflicts</h1>
        <p className="text-sm text-muted-foreground">
          Concurrent writes from the field. Pick the authoritative record.
        </p>
      </div>
      {(data ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          No unresolved conflicts.
        </p>
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((c: { id: string; description: string; created_at: string; entity_type: string }) => (
            <li key={c.id} className="rounded-md border border-border bg-white p-4 text-sm">
              <p className="font-medium text-navy-900">{c.entity_type}</p>
              <p className="text-muted-foreground">{c.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatRelative(c.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
