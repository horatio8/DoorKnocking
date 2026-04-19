import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { AdminMessagesView } from "@/components/admin/messages-view";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }

  const client = await getActiveClient();
  const supabase = getSupabaseServiceRoleClient();

  const { data: districts } = await supabase
    .from("districts")
    .select("id, name, client_id")
    .eq("active", true)
    .order("name");
  const scoped = ((districts ?? []) as Array<{ id: string; name: string; client_id: string | null }>)
    .filter((d) => !client || d.client_id === client.id);

  return <AdminMessagesView districts={scoped.map((d) => ({ id: d.id, name: d.name }))} />;
}
