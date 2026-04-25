import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getActiveDistrict, listScopedDistricts } from "@/lib/districts/active";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const EXPORTS = [
  { slug: "voters", label: "Voters" },
  { slug: "households", label: "Households" },
  { slug: "knock_events", label: "Knock events" },
  { slug: "survey_responses", label: "Survey responses" },
];

// CSV exports are inherently per-district (the API takes a single
// district query param). When a district is pinned via the global
// switcher, jump straight to its export. Otherwise list one row per
// in-scope district so the admin doesn't have to switch context first.
export default async function AdminExport() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }

  const [pinnedDistrict, scopedDistricts] = await Promise.all([
    getActiveDistrict(),
    listScopedDistricts(),
  ]);
  const districts = pinnedDistrict
    ? scopedDistricts.filter((d) => d.id === pinnedDistrict.id)
    : scopedDistricts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Export</h1>
        <p className="text-sm text-muted-foreground">
          Download district-scoped CSVs or jump into Airtable.
          {pinnedDistrict
            ? ` Scoped to ${pinnedDistrict.name}.`
            : districts.length > 1
              ? ` Pick a district below — exports are per-district.`
              : districts.length === 1
                ? ` Scoped to ${districts[0].name}.`
                : ""}
        </p>
      </div>

      {districts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
          No districts in scope. Pick an active client up top, or have a
          super_admin grant district access on /admin/users.
        </div>
      ) : (
        districts.map((d) => (
          <section key={d.id} className="space-y-3">
            {districts.length > 1 ? (
              <h2 className="text-sm font-semibold text-navy-900">{d.name}</h2>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {EXPORTS.map((e) => (
                <Card key={`${d.id}-${e.slug}`}>
                  <CardHeader>
                    <CardTitle>{e.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={`/api/export/${e.slug}?district=${d.id}`}
                      className="rounded-md border border-navy-100 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy-50"
                    >
                      Download CSV
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
            {d.airtable_base_id ? (
              <div className="rounded-md border border-border bg-white p-4 text-sm">
                <p className="font-medium text-navy-900">Airtable base</p>
                <a
                  href={`https://airtable.com/${d.airtable_base_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-navy-700 underline"
                >
                  Open {d.name} in Airtable
                </a>
              </div>
            ) : null}
          </section>
        ))
      )}
    </div>
  );
}
