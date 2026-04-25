"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";

// Client-side polling wrapper for the import-jobs table on
// /admin/system/jobs. Refreshes every 5s while ANY job is in a
// non-terminal state (queued / pushing / pushed / importing); stops
// when everything's settled to avoid hammering the API when the queue
// is idle.

interface JobRow {
  id: string;
  district_id: string;
  status: string;
  rows_total: number;
  rows_pushed: number;
  rows_imported: number;
  rows_geocoded: number;
  rows_failed: number;
  error_message: string | null;
  // Knock-import side-effect counts + samples written by the worker
  // (see app/api/cron/import-worker/route.ts knocks_imported branch).
  // Optional — older jobs predating the knock-import path don't have it.
  error_detail: {
    knocks_attempted?: number;
    knocks_inserted?: number;
    knocks_skipped_no_status?: number;
    knocks_skipped_unknown_status?: number;
    knocks_skipped_no_voter?: number;
    knocks_failed?: number;
    knocks_errors?: string[];
    knocks_unknown_status_samples?: Array<{ value: string; count: number }>;
    knocks_unmatched_voter_keys?: string[];
  } | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

const ACTIVE_STATUSES = new Set(["queued", "pushing", "pushed", "importing"]);

export function ImportJobsLive({
  initial,
  districtNameById,
}: {
  initial: JobRow[];
  districtNameById: Record<string, string>;
}) {
  const [rows, setRows] = useState<JobRow[]>(initial);

  useEffect(() => {
    const hasActive = rows.some((r) => ACTIVE_STATUSES.has(r.status));
    if (!hasActive) return;
    let cancelled = false;
    const handle = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/import-jobs", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { jobs: JobRow[] };
        if (cancelled) return;
        setRows(body.jobs ?? []);
      } catch {
        // Network blip — next tick will retry.
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        No import jobs yet. Upload a voter file via Airtable sync to kick one off.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((job) => {
        const pushPct =
          job.rows_total > 0 ? Math.round((job.rows_pushed / job.rows_total) * 100) : 0;
        const importPct =
          job.rows_total > 0 ? Math.round((job.rows_imported / job.rows_total) * 100) : 0;
        const districtName = districtNameById[job.district_id] ?? job.district_id;
        const elapsed = job.started_at
          ? Math.round(
              ((job.finished_at ? new Date(job.finished_at).getTime() : Date.now()) -
                new Date(job.started_at).getTime()) /
                1000,
            )
          : 0;
        return (
          <li key={job.id} className="space-y-2 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-navy-900">{districtName}</p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-mono">{job.id.slice(0, 8)}…</span>
                  {" · "}created {formatRelative(job.created_at)}
                  {job.started_at && ACTIVE_STATUSES.has(job.status)
                    ? ` · ${Math.floor(elapsed / 60)}m ${elapsed % 60}s in progress`
                    : null}
                  {job.finished_at ? ` · finished ${formatRelative(job.finished_at)}` : null}
                </p>
              </div>
              <JobStatusChip status={job.status} />
            </div>

            {job.rows_total > 0 ? (
              <div className="grid gap-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    Airtable {job.rows_pushed.toLocaleString()} / {job.rows_total.toLocaleString()}
                  </span>
                  <span>{pushPct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
                  <div
                    className="h-full bg-navy-900 transition-all"
                    style={{ width: `${pushPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    Supabase {job.rows_imported.toLocaleString()} / {job.rows_total.toLocaleString()}
                    {" · "}
                    {job.rows_geocoded.toLocaleString()} geocoded
                    {job.rows_failed > 0 ? ` · ${job.rows_failed.toLocaleString()} skipped` : ""}
                  </span>
                  <span>{importPct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
                  <div
                    className="h-full bg-emerald-600 transition-all"
                    style={{ width: `${importPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            {job.status === "failed" && job.error_message ? (
              <p className="rounded bg-crimson/10 px-2 py-1 text-[11px] text-crimson">
                {job.error_message}
              </p>
            ) : null}

            {/* Knock-import side-effect summary. Folded into a
                <details> so the admin can drill in only when there's
                something to see; otherwise it stays out of the way. */}
            {job.error_detail &&
            (typeof job.error_detail.knocks_inserted === "number" ||
              typeof job.error_detail.knocks_skipped_unknown_status === "number") ? (
              <details className="rounded border border-border/70 bg-navy-50/40 p-2 text-[11px] open:bg-navy-50/60">
                <summary className="cursor-pointer text-navy-800">
                  Knock-history side-step:{" "}
                  <span className="font-medium">
                    {(job.error_detail.knocks_inserted ?? 0).toLocaleString()} applied
                  </span>
                  {(job.error_detail.knocks_skipped_unknown_status ?? 0) > 0
                    ? ` · ${(job.error_detail.knocks_skipped_unknown_status ?? 0).toLocaleString()} unrecognised`
                    : ""}
                  {(job.error_detail.knocks_skipped_no_voter ?? 0) > 0
                    ? ` · ${(job.error_detail.knocks_skipped_no_voter ?? 0).toLocaleString()} unmatched voter`
                    : ""}
                </summary>
                <div className="mt-2 space-y-2">
                  {job.error_detail.knocks_unknown_status_samples &&
                  job.error_detail.knocks_unknown_status_samples.length > 0 ? (
                    <div>
                      <p className="font-semibold text-navy-700">
                        Unrecognised status values (top {job.error_detail.knocks_unknown_status_samples.length})
                      </p>
                      <ul className="mt-1 space-y-0.5 font-mono">
                        {job.error_detail.knocks_unknown_status_samples.map((s) => (
                          <li key={s.value}>
                            <span className="rounded bg-white/70 px-1.5 py-0.5">&ldquo;{s.value}&rdquo;</span>
                            <span className="ml-2 text-navy-600">{s.count.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {job.error_detail.knocks_unmatched_voter_keys &&
                  job.error_detail.knocks_unmatched_voter_keys.length > 0 ? (
                    <div>
                      <p className="font-semibold text-navy-700">
                        Sample unmatched voter keys ({job.error_detail.knocks_unmatched_voter_keys.length})
                      </p>
                      <ul className="mt-1 space-y-0.5 font-mono">
                        {job.error_detail.knocks_unmatched_voter_keys.map((k) => (
                          <li key={k}>
                            <span className="rounded bg-white/70 px-1.5 py-0.5">{k}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {job.error_detail.knocks_errors && job.error_detail.knocks_errors.length > 0 ? (
                    <div>
                      <p className="font-semibold text-crimson">First {job.error_detail.knocks_errors.length} errors</p>
                      <ul className="mt-1 space-y-0.5 font-mono text-crimson">
                        {job.error_detail.knocks_errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function JobStatusChip({ status }: { status: string }) {
  switch (status) {
    case "imported":
      return <Badge variant="success">Complete</Badge>;
    case "pushing":
    case "pushed":
    case "importing":
      return <Badge variant="warning">{status}</Badge>;
    case "queued":
      return <Badge variant="secondary">Queued</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "paused":
      return <Badge variant="secondary">Paused</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
