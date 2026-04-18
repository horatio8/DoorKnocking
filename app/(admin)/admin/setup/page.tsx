import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSetupStatus } from "@/lib/setup/status";
import { SetupWizard } from "@/components/admin/setup/setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/admin");
  }

  const status = await getSetupStatus(session.user);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Setup wizard</h1>
          <p className="text-sm text-muted-foreground">
            Step-by-step configuration for everything this campaign needs. Every field here is also
            available on its own settings page — the wizard is just a guided tour.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-xs text-muted-foreground underline hover:text-navy-700"
        >
          Skip to dashboard
        </Link>
      </div>

      <SetupWizard status={status} />
    </div>
  );
}
