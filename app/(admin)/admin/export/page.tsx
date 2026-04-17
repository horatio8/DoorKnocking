import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const EXPORTS = [
  { slug: "voters", label: "Voters" },
  { slug: "households", label: "Households" },
  { slug: "knock_events", label: "Knock events" },
  { slug: "survey_responses", label: "Survey responses" },
];

export default async function AdminExport() {
  const session = await loadSession();
  if (!session) redirect("/login");

  const airtableDeepLink = session.district?.airtable_base_id
    ? `https://airtable.com/${session.district.airtable_base_id}`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Export</h1>
        <p className="text-sm text-muted-foreground">
          Download district-scoped CSVs or jump into Airtable.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {EXPORTS.map((e) => (
          <Card key={e.slug}>
            <CardHeader>
              <CardTitle>{e.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={`/api/export/${e.slug}?district=${session.district?.id ?? ""}`}
                className="rounded-md border border-navy-100 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy-50"
              >
                Download CSV
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {airtableDeepLink ? (
        <div className="rounded-md border border-border bg-white p-4 text-sm">
          <p className="font-medium text-navy-900">Airtable base</p>
          <a
            href={airtableDeepLink}
            target="_blank"
            rel="noreferrer"
            className="text-navy-700 underline"
          >
            Open {session.district?.name} in Airtable
          </a>
        </div>
      ) : null}
    </div>
  );
}
