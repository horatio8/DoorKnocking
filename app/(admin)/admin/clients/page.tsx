import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { CreateClientForm } from "@/components/admin/create-client-form";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminClients() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "super_admin") redirect("/admin");

  const supabase = getSupabaseServerClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*, districts(id)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Each client gets their own subdomain. Districts, users, and data all roll up to a client.
          </p>
        </div>
        <CreateClientForm />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">Slug</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Districts</th>
              <th className="px-3 py-2 text-left">Contact</th>
              <th className="px-3 py-2 text-left">Active</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">URL</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c: {
              id: string;
              slug: string;
              name: string;
              districts?: Array<{ id: string }>;
              contact_email: string | null;
              active: boolean;
              created_at: string;
            }) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{c.slug}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2">{c.districts?.length ?? 0}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.contact_email ?? "—"}</td>
                <td className="px-3 py-2">
                  {c.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Paused</Badge>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatRelative(c.created_at)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {c.slug}.campaignos.com
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(clients ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No clients yet. Create one above.</p>
        ) : null}
      </div>
    </div>
  );
}
