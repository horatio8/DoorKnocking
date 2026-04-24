import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import { ImportJobsLive } from "@/components/admin/import-jobs-live";

export const dynamic = "force-dynamic";

// /admin/system/jobs — one page surfacing every long-running operation
// the platform runs on behalf of a client. Three columns for now:
//
//   1. Import jobs: Airtable push + Supabase import queue. The admin's
//      view of the cron worker draining their uploads.
//   2. Voice-note transcription: per-status counts from voice_notes.
//      The cron at /api/cron/transcribe-voice-notes picks up pending
//      rows every 10 minutes.
//   3. Scheduled crons: a static list of the cron paths + their vercel
//      schedules so admins can see what's supposed to run and when.
//      We don't log cron run history yet — if that becomes important
//      we'll add a cron_runs table.

const CRONS: Array<{ path: string; schedule: string; purpose: string }> = [
  {
    path: "/api/cron/import-worker",
    schedule: "* * * * *",
    purpose: "Drains the import_jobs queue every minute.",
  },
  {
    path: "/api/cron/transcribe-voice-notes",
    schedule: "*/10 * * * *",
    purpose: "Whisper + Claude + Airtable mirror for new voice notes.",
  },
  {
    path: "/api/cron/walkbook-maintenance",
    schedule: "0 5 * * *",
    purpose: "Nightly stats + recompute walkbook aggregates (5am UTC).",
  },
];

export default async function BackgroundJobsPage() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/admin");
  }

  const supabase = getSupabaseServiceRoleClient();

  const [recentJobsRes, voiceCountsRes, recentVoicesRes] = await Promise.all([
    supabase
      .from("import_jobs")
      .select(
        "id, district_id, status, rows_total, rows_pushed, rows_imported, rows_geocoded, rows_failed, error_message, started_at, finished_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(15),
    // Roll counts into one single query via aggregates.
    supabase
      .from("voice_notes")
      .select("transcription_status")
      .limit(2000),
    supabase
      .from("voice_notes")
      .select("id, transcription_status, note_kind, audio_duration_seconds, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const recentJobs =
    (recentJobsRes.data ?? []) as Array<{
      id: string;
      district_id: string;
      status: string;
      rows_total: number;
      rows_pushed: number;
      rows_imported: number;
      rows_geocoded: number;
      rows_failed: number;
      error_message: string | null;
      started_at: string | null;
      finished_at: string | null;
      created_at: string;
    }>;

  const voiceCounts = ((voiceCountsRes.data ?? []) as Array<{ transcription_status: string }>).reduce(
    (acc, row) => {
      const key = row.transcription_status ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const recentVoices = (recentVoicesRes.data ?? []) as Array<{
    id: string;
    transcription_status: string;
    note_kind: string | null;
    audio_duration_seconds: number | null;
    created_at: string;
  }>;

  const districtIds = Array.from(new Set(recentJobs.map((j) => j.district_id)));
  const { data: districtRows } = districtIds.length
    ? await supabase.from("districts").select("id, name").in("id", districtIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const districtNameById = new Map(
    ((districtRows ?? []) as Array<{ id: string; name: string }>).map((d) => [d.id, d.name]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Background operations</h1>
        <p className="text-sm text-muted-foreground">
          Every long-running task the platform runs for you — imports, transcriptions, nightly
          aggregates. Watch live or audit what ran.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-white p-4">
        <h2 className="font-medium text-navy-900">Import jobs</h2>
        <p className="text-xs text-muted-foreground">
          Airtable push + Supabase upsert for every admin-initiated file import. Live-updating.
        </p>
        <div className="mt-3">
          <ImportJobsLive initial={recentJobs} districtNameById={Object.fromEntries(districtNameById)} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-white p-4">
        <h2 className="font-medium text-navy-900">Voice-note transcription</h2>
        <p className="text-xs text-muted-foreground">
          Whisper diarisation + Claude summary + Airtable mirror. Cron runs every 10 minutes.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <CountCard label="Pending" value={voiceCounts.pending ?? 0} tone="warning" />
          <CountCard label="Processing" value={voiceCounts.processing ?? 0} tone="info" />
          <CountCard label="Complete" value={voiceCounts.complete ?? 0} tone="success" />
          <CountCard label="Errored" value={voiceCounts.error ?? voiceCounts.failed ?? 0} tone="crimson" />
        </div>
        {recentVoices.length > 0 ? (
          <ul className="mt-4 divide-y divide-border text-sm">
            {recentVoices.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-1.5">
                <span className="font-mono text-[11px] text-navy-700">
                  {v.id.slice(0, 8)}… · {v.note_kind ?? "note"}
                  {v.audio_duration_seconds != null ? ` · ${v.audio_duration_seconds}s` : ""}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <VoiceStatusChip status={v.transcription_status} />
                  <span>{formatRelative(v.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            No voice notes recorded yet.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-white p-4">
        <h2 className="font-medium text-navy-900">Scheduled crons</h2>
        <p className="text-xs text-muted-foreground">
          Vercel-triggered schedules. Changing these requires an edit to{" "}
          <code className="font-mono text-[11px]">vercel.json</code> and a redeploy.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-widest text-navy-500">
            <tr>
              <th className="py-1.5">Path</th>
              <th className="py-1.5">Schedule</th>
              <th className="py-1.5">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {CRONS.map((c) => (
              <tr key={c.path} className="border-t border-border">
                <td className="py-2 pr-3 font-mono text-[11px] text-navy-700">{c.path}</td>
                <td className="py-2 pr-3 font-mono text-[11px] text-navy-700">{c.schedule}</td>
                <td className="py-2 text-xs text-muted-foreground">{c.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "success" | "warning" | "crimson";
}) {
  const bg: Record<typeof tone, string> = {
    info: "bg-navy-50 text-navy-900",
    success: "bg-emerald-50 text-emerald-900",
    warning: "bg-amber-50 text-amber-900",
    crimson: "bg-crimson/10 text-crimson",
  };
  return (
    <div className={`rounded-md p-3 ${bg[tone]}`}>
      <p className="text-[10px] uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function VoiceStatusChip({ status }: { status: string }) {
  switch (status) {
    case "complete":
      return <Badge variant="success">Complete</Badge>;
    case "processing":
      return <Badge variant="warning">Processing</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "error":
    case "failed":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
