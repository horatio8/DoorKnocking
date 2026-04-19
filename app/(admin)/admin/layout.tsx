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
import { GlobalSearch } from "@/components/admin/global-search";
import { LogoutButton } from "@/components/knocker/logout-button";
import { getActiveClient } from "@/lib/clients/active";
import { AdminBillingStatus } from "@/components/admin/admin-billing-status";
import { getBillingState } from "@/lib/billing/trial";

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
  if (session.user.must_change_password) {
    redirect("/set-password");
  }

  // Self-serve admins who finished signup but not the 3-step wizard get
  // bounced back to finish it before any admin route becomes reachable.
  // (Admins that came up via old paths won't have trial_started_at set, so
  // they skip this gate.)
  if (session.user.trial_started_at && !session.user.setup_completed_at) {
    redirect("/setup/role");
  }

  // Pull billing state once and use it for the banner + hard gate.
  const billing = await getBillingState();
  if (billing.trialEnded && !billing.hasPaymentMethod && billing.subscriptionStatus !== "active") {
    redirect("/billing/activate");
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

  // Civic-aesthetic admin shell — same layout primitives, civic palette
  // throughout. Plan badge at the bottom of the sidebar reflects live
  // billing state. Existing ClientSwitcher / GlobalSearch / super-admin
  // shortcuts kept verbatim.
  const planBadge = billing.subscriptionStatus === "active"
    ? `${(billing.planName ?? "PRO").toUpperCase()} · ACTIVE`
    : billing.subscriptionStatus === "past_due" || billing.subscriptionStatus === "unpaid"
      ? "PRO · PAST DUE"
      : billing.trialEnded
        ? "TRIAL · ENDED"
        : `TRIAL · ${billing.trialDaysLeft} DAYS LEFT`;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-60 flex-col border-r border-rule-dark bg-civic-navy text-parchment md:flex">
        <div className="border-b border-parchment/10 p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-parchment/55">{brandLabel}</p>
          <p className="mt-0.5 font-serif text-lg font-semibold text-parchment">Knock</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-3 text-sm">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-2 rounded-sm px-3 py-2 text-parchment/80 no-underline hover:bg-parchment/10 hover:text-parchment"
              >
                <Icon className="h-4 w-4 text-parchment/60 group-hover:text-oxblood" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-parchment/10 p-4 text-xs">
          <p className="text-[9px] uppercase tracking-[0.12em] text-parchment/55">Plan</p>
          <p className="mt-0.5 font-mono text-[11px] font-semibold text-oxblood">{planBadge}</p>
          <hr className="my-3 border-0 border-t border-parchment/10" />
          <p className="truncate text-parchment/70">{session.user.email}</p>
          <p className="capitalize text-parchment/55">{session.user.role.replace("_", " ")}</p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-rule bg-white px-5 py-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-mute">Client</p>
              <ClientSwitcher activeClientId={client?.id ?? null} clients={clients} />
            </div>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2">
            {session.user.role === "super_admin" && (
              <Link
                href="/admin/clients?new=1"
                className="inline-flex items-center gap-1 rounded-sm border border-civic-navy bg-civic-navy px-3 py-1.5 text-xs font-semibold text-parchment no-underline hover:bg-civic-navy-2"
              >
                <Sparkles className="h-3 w-3" /> Start Client Setup
              </Link>
            )}
            <Link
              href="/app/map"
              className="inline-flex items-center gap-1 rounded-sm border border-rule bg-white px-3 py-1.5 text-xs font-semibold text-civic-navy no-underline hover:border-civic-navy hover:bg-parchment"
            >
              <ListTodo className="h-3 w-3" /> Field view
            </Link>
          </div>
        </header>
        <AdminBillingStatus billing={billing} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
