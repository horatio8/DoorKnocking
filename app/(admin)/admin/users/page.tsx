import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { InviteUserForm } from "@/components/admin/invite-user-form";

export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();
  const { data: users } = await supabase.from("users").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Users</h1>
          <p className="text-sm text-muted-foreground">Knockers and admins across the platform.</p>
        </div>
        <InviteUserForm defaultDistrictId={session.district?.id ?? null} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Active</th>
              <th className="px-3 py-2 text-left">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u: {
              id: string;
              full_name?: string | null;
              email: string;
              role: string;
              active: boolean;
              last_seen_at?: string | null;
            }) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{u.full_name ?? "—"}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 capitalize">{u.role.replace("_", " ")}</td>
                <td className="px-3 py-2">{u.active ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
