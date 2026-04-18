import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  Database,
  Download,
  Flag,
  Home,
  ListTodo,
  Map,
  MapPin,
  Settings as SettingsIcon,
  Sparkles,
  Tag as TagIcon,
  Users,
} from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ClientSwitcher } from "@/components/admin/client-switcher";
import { LogoutButton } from "@/components/knocker/logout-button";
import { getActiveClient } from "@/lib/clients/active";

const NAV = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/airtable", label: "Airtable sync", icon: Database },
  { href: "/admin/walkbooks", label: "Walkbooks", icon: Map },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/surveys", label: "Surveys", icon: ClipboardList },
  { href: "/admin/tags", label: "Tags", icon: TagIcon },
  { href: "/admin/conflicts", label: "Conflicts", icon: Flag },
  { href: "/admin/households", label: "Households", icon: Home },
  { href: "/admin/export", label: "Export", icon: Download },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

const SUPER_NAV = [
  { href: "/admin/clients", label: "Clients", icon: MapPin },
  { href: "/admin/districts", label: "Districts", icon: MapPin },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }

  const supabase = getSupabaseServerClient();
  const client = await getActiveClient();

  const clientsQuery = supabase
    .from("clients")
    .select("id, name, slug")
    .eq("active", true)
    .order("name");
  const { data: clientsData } = await clientsQuery;
  const clients = (clientsData ?? []) as Array<{ id: string; name: string; slug: string }>;

  const nav = [...NAV, ...(session.user.role === "super_admin" ? SUPER_NAV : [])];
  const brandLabel = client?.name ?? "Campaign OS";

  return (
    <div className="flex min-h-screen bg-navy-50">
      <aside className="hidden w-60 flex-col border-r border-border bg-white md:flex">
        <div className="border-b border-border p-5">
          <p className="text-[10px] uppercase tracking-widest text-navy-500">{brandLabel}</p>
          <p className="font-serif text-lg font-semibold text-navy-900">Door Knock</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-3 text-sm">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-navy-700 hover:bg-navy-50"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <p className="truncate">{session.user.email}</p>
          <p className="capitalize">{session.user.role.replace("_", " ")}</p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-white px-5 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-navy-500">Client</p>
            <ClientSwitcher activeClientId={client?.id ?? null} clients={clients} />
          </div>
          <div className="flex items-center gap-2">
            {session.user.role === "super_admin" && (
              <Link
                href="/admin/clients?new=1"
                className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800"
              >
                <Sparkles className="mr-1 inline h-3 w-3" /> Start Client Setup
              </Link>
            )}
            <Link
              href="/app/map"
              className="rounded-md border border-navy-100 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-50"
            >
              <ListTodo className="mr-1 inline h-3 w-3" /> Field view
            </Link>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
