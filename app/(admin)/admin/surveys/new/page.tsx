import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewSurvey() {
  return (
    <div className="space-y-5">
      <Link href="/admin/surveys" className="inline-flex items-center gap-1 text-sm text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Surveys
      </Link>
      <h1 className="font-serif text-2xl font-semibold text-navy-900">New survey</h1>
      <p className="text-sm text-muted-foreground">
        Surveys are authored in Airtable (see <code>docs/airtable-schema.md</code>). The n8n
        Airtable → Supabase workflow picks them up within 5 minutes. A richer in-app editor
        is planned for Phase 3.
      </p>
    </div>
  );
}
