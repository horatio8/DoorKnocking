import { notFound, redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ScriptEditor } from "@/components/admin/script-editor";

export const dynamic = "force-dynamic";

export default async function ScriptEditPage({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") redirect("/app");

  const supabase = getSupabaseServiceRoleClient();
  const { data } = await supabase.from("scripts").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();

  const s = data as {
    id: string;
    name: string;
    body_md: string | null;
    priority: number;
    status: "draft" | "active" | "paused" | "archived";
  };
  return (
    <ScriptEditor
      id={s.id}
      initial={{
        name: s.name,
        body_md: s.body_md ?? "",
        priority: s.priority,
        status: s.status,
      }}
    />
  );
}
