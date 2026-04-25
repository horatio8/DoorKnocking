"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_FIELDS, type FieldMapping } from "@/lib/airtable/mapping";

interface Props {
  districtId: string;
  districtName: string;
  hasCanonicalBase: boolean;
}

interface UploadResponse {
  import_file: { id: string; row_count: number; original_filename: string; parsed_header: string[] };
  preview: { header: string[]; rows: Array<Record<string, string>>; total_rows: number };
  proposal: {
    mapping: FieldMapping;
    confidence: Record<string, "high" | "medium" | "low">;
    reasoning: Record<string, string>;
    warnings: string[];
    unmapped_airtable_fields: string[];
  } | null;
}

type Step = "upload" | "review" | "provision" | "push" | "done";

interface ImportJobSnapshot {
  id: string;
  status:
    | "queued"
    | "pushing"
    | "pushed"
    | "importing"
    | "imported"
    | "failed"
    | "paused";
  rows_total: number;
  rows_pushed: number;
  rows_fetched: number;
  rows_geocoded: number;
  rows_imported: number;
  rows_failed: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  // Optional knock-history side-effect from the CSV (only present
  // when the admin mapped a knock_status column). Folded into
  // error_detail by the import worker so we don't have to add new
  // columns just for this.
  error_detail: {
    knocks_attempted?: number;
    knocks_inserted?: number;
    knocks_skipped_no_status?: number;
    knocks_skipped_unknown_status?: number;
    knocks_skipped_no_voter?: number;
    knocks_failed?: number;
    knocks_errors?: string[];
  } | null;
}

const STEPS: Array<{ key: Step; label: string }> = [
  { key: "upload", label: "1. Upload file" },
  { key: "review", label: "2. Review mapping" },
  { key: "provision", label: "3. Create base" },
  { key: "push", label: "4. Push rows" },
];

export function AirtableFileUploadWizard({ districtId, districtName, hasCanonicalBase }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [uploadState, setUploadState] = useState<UploadResponse | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  // Two paths for installing the canonical schema:
  //   existing — pick an Airtable base the admin already has; we drop
  //              the four tables in. No workspaceId needed.
  //   create  — paste a workspaceId and we create a fresh base.
  const [provisionMode, setProvisionMode] = useState<"existing" | "create">("existing");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [existingBaseId, setExistingBaseId] = useState<string>("");
  const [bases, setBases] = useState<
    Array<{ id: string; name: string; permissionLevel?: string }>
  >([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{ base_id: string; reused: boolean } | null>(
    hasCanonicalBase ? { base_id: "(already provisioned)", reused: true } : null,
  );
  const [pushSummary, setPushSummary] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ImportJobSnapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy("Uploading & parsing…");
    setError(null);
    try {
      const form = new FormData();
      form.set("district_id", districtId);
      form.set("file", file);
      const res = await fetch("/api/admin/airtable/upload", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setUploadState(body as UploadResponse);
      setMapping(body.proposal?.mapping ?? {});
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveMapping() {
    if (!uploadState) return;
    setBusy("Saving mapping…");
    setError(null);
    try {
      const res = await fetch("/api/admin/airtable/upload/mapping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import_file_id: uploadState.import_file.id, mapping }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setStep(hasCanonicalBase ? "push" : "provision");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Pull saved workspace id + the admin's existing bases on mount so
  // the picker populates without a manual "Load" click.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/airtable/provision?district_id=${encodeURIComponent(districtId)}`,
        );
        const body = await res.json();
        if (cancelled || !res.ok) return;
        if (body.suggested) setWorkspaceId(body.suggested);
        if (Array.isArray(body.bases)) setBases(body.bases);
      } catch {
        // Non-fatal — the admin can still paste their workspace id
        // or retry. UI will render the create-new fallback.
      } finally {
        if (!cancelled) setOptionsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [districtId]);

  // Poll the import_jobs row every 2s while one is active so the
  // admin sees live counters. Stops polling once the job settles
  // (imported or failed). The cron worker owns the row; we only read.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const res = await fetch(`/api/admin/import-jobs/${jobId}`);
        const body = await res.json();
        if (cancelled || !res.ok) return;
        const job = body.job as ImportJobSnapshot;
        setJobStatus(job);
        if (job.status === "imported") {
          {
            const knockBits: string[] = [];
            const ed = job.error_detail;
            if (ed && typeof ed.knocks_inserted === "number" && ed.knocks_inserted > 0) {
              knockBits.push(`${ed.knocks_inserted} knock update${ed.knocks_inserted === 1 ? "" : "s"} applied`);
            }
            if (ed && typeof ed.knocks_skipped_unknown_status === "number" && ed.knocks_skipped_unknown_status > 0) {
              knockBits.push(`${ed.knocks_skipped_unknown_status} unrecognised status${ed.knocks_skipped_unknown_status === 1 ? "" : "es"} skipped`);
            }
            if (ed && typeof ed.knocks_skipped_no_voter === "number" && ed.knocks_skipped_no_voter > 0) {
              knockBits.push(`${ed.knocks_skipped_no_voter} knock${ed.knocks_skipped_no_voter === 1 ? "" : "s"} couldn't match a voter`);
            }
            const knockSummary = knockBits.length > 0 ? ` · ${knockBits.join(" · ")}` : "";
            setPushSummary(
              `Imported ${job.rows_imported} voter${job.rows_imported === 1 ? "" : "s"} · ${job.rows_geocoded} geocoded${job.rows_failed > 0 ? ` · ${job.rows_failed} skipped` : ""}${knockSummary}`,
            );
          }
          setStep("done");
          router.refresh();
          return;
        }
        if (job.status === "failed") {
          setError(job.error_message || "Import failed.");
          return;
        }
      } catch {
        // Transient — keep polling.
      }
      if (!cancelled) timeout = setTimeout(tick, 2000);
    }
    tick();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [jobId, router]);

  async function provisionBase() {
    setBusy(
      provisionMode === "existing"
        ? "Adding four tables to your base…"
        : "Creating base + four tables…",
    );
    setError(null);
    try {
      const payload =
        provisionMode === "existing"
          ? { district_id: districtId, base_id: existingBaseId }
          : { district_id: districtId, workspace_id: workspaceId };
      const res = await fetch("/api/admin/airtable/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setProvisionResult({ base_id: body.base_id, reused: body.reused });
      setStep("push");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function pushRows() {
    if (!uploadState) return;
    if (!confirm(`Push ${uploadState.import_file.row_count} rows into Airtable and import?`)) return;
    setBusy("Queuing the import…");
    setError(null);
    setJobStatus(null);
    try {
      const res = await fetch("/api/admin/airtable/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import_file_id: uploadState.import_file.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      // Kick the worker immediately so the admin doesn't wait up to
      // 60s for the next cron tick. Fire-and-forget — the worker is
      // idempotent and the cron will pick up anything we miss.
      fetch("/api/cron/import-worker").catch(() => undefined);
      setJobId(body.job_id as string);
      setBusy(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Stepper current={step} />

      {step === "upload" ? (
        <div className="space-y-4 rounded-lg border border-border bg-white p-4">
          <div>
            <h2 className="font-medium text-navy-900">Upload voter file</h2>
            <p className="text-xs text-muted-foreground">
              CSV or XLSX, up to 25 MB. We&apos;ll stage the file, auto-map
              columns, and push into the {districtName} base.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-navy-200 bg-navy-50/30 px-6 py-12 text-center"
          >
            <FileSpreadsheet className="h-10 w-10 text-navy-400" />
            <div>
              <p className="text-sm font-medium text-navy-900">Drop your file here</p>
              <p className="text-xs text-muted-foreground">or</p>
            </div>
            <Button
              type="button"
              variant="accent"
              onClick={() => inputRef.current?.click()}
              disabled={!!busy}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {busy ?? "Choose a file"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "review" && uploadState ? (
        <ReviewStep
          uploadState={uploadState}
          mapping={mapping}
          onChange={(k, v) => setMapping((m) => ({ ...m, [k]: v }))}
          onBack={() => setStep("upload")}
          onNext={saveMapping}
          busy={busy}
        />
      ) : null}

      {step === "provision" ? (
        <ProvisionStep
          mode={provisionMode}
          onModeChange={setProvisionMode}
          workspaceId={workspaceId}
          onWorkspaceChange={setWorkspaceId}
          bases={bases}
          existingBaseId={existingBaseId}
          onBaseChange={setExistingBaseId}
          onProvision={provisionBase}
          result={provisionResult}
          busy={busy}
          districtName={districtName}
          loaded={optionsLoaded}
        />
      ) : null}

      {step === "push" ? (
        <div className="space-y-3 rounded-lg border border-border bg-white p-4">
          <h2 className="font-medium text-navy-900">Push {uploadState?.import_file.row_count ?? "?"} rows</h2>
          <p className="text-xs text-muted-foreground">
            Pushes to the canonical Airtable base and upserts into the
            platform database in the background. Safe to leave this page
            open or come back — the worker polls every minute.
          </p>
          {provisionResult ? (
            <p className="text-[11px] text-muted-foreground">
              Target base: <span className="font-mono">{provisionResult.base_id}</span>
              {provisionResult.reused ? " · reused existing" : " · created just now"}
            </p>
          ) : null}

          {jobStatus ? (
            <ImportJobProgress job={jobStatus} />
          ) : jobId ? (
            <p className="rounded-md border border-navy-100 bg-navy-50/40 px-3 py-2 text-xs text-navy-700">
              Job queued — waiting for the worker to pick it up…
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("review")} disabled={!!jobId}>
              Back
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={pushRows}
              disabled={!!busy || !!jobId}
            >
              {busy ?? (jobId ? "Running in background…" : "Push rows")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Import complete.</p>
          {pushSummary ? <p className="mt-1 text-xs">{pushSummary}</p> : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md bg-crimson/10 px-3 py-2 text-sm text-crimson">{error}</p>
      ) : null}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {STEPS.map((s, i) => (
        <span
          key={s.key}
          className={`rounded-full px-3 py-1 ${
            i <= idx ? "bg-navy text-white" : "bg-navy-50 text-navy-500"
          }`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function ReviewStep({
  uploadState,
  mapping,
  onChange,
  onBack,
  onNext,
  busy,
}: {
  uploadState: UploadResponse;
  mapping: FieldMapping;
  onChange(key: string, value: string | null): void;
  onBack(): void;
  onNext(): void;
  busy: string | null;
}) {
  const grouped = PLATFORM_FIELDS.reduce<Record<string, typeof PLATFORM_FIELDS>>((acc, f) => {
    (acc[f.group] ||= []).push(f);
    return acc;
  }, {});
  const groupOrder = ["identity", "name", "address", "contact", "party", "metadata", "knock"];
  const { preview, proposal } = uploadState;
  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-4">
      <div>
        <h2 className="font-medium text-navy-900">Review column mapping</h2>
        <p className="text-xs text-muted-foreground">
          Source: <span className="font-mono">{uploadState.import_file.original_filename}</span> ·
          {` ${preview.total_rows} rows · ${preview.header.length} columns.`}
        </p>
      </div>

      {proposal?.warnings?.length ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">Warnings from Claude:</p>
          <ul className="ml-4 list-disc">
            {proposal.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      ) : null}

      {groupOrder.map((g) => {
        const fields = grouped[g] ?? [];
        if (fields.length === 0) return null;
        return (
          <div key={g} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">{g}</p>
            <table className="w-full text-sm">
              <tbody>
                {fields.map((pf) => {
                  const conf = proposal?.confidence[pf.key];
                  const reason = proposal?.reasoning[pf.key];
                  return (
                    <tr key={pf.key} className="border-b border-border last:border-0">
                      <td className="w-1/3 py-2 align-top">
                        <div className="font-medium text-navy-900">
                          {pf.label}
                          {pf.required ? <span className="text-crimson"> *</span> : null}
                        </div>
                        {pf.description ? (
                          <p className="text-[11px] text-muted-foreground">{pf.description}</p>
                        ) : null}
                      </td>
                      <td className="w-1/3 py-2 align-top">
                        <select
                          value={mapping[pf.key] ?? ""}
                          onChange={(e) => onChange(pf.key, e.target.value || null)}
                          className="w-full rounded border border-input bg-white px-2 py-1 text-sm"
                        >
                          <option value="">— not mapped —</option>
                          {preview.header.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="w-1/3 py-2 align-top text-xs text-muted-foreground">
                        {conf ? <ConfidenceChip level={conf} /> : null}
                        {reason ? <span className="ml-1">{reason}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="max-h-[260px] overflow-auto rounded border border-border">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead className="sticky top-0 bg-navy-50 text-left">
            <tr>
              {preview.header.map((h) => (
                <th key={h} className="px-2 py-1 font-medium text-navy-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r, i) => (
              <tr key={i} className="border-t border-border odd:bg-white even:bg-navy-50/30">
                {preview.header.map((h) => (
                  <td key={h} className="max-w-[220px] truncate px-2 py-1" title={r[h] ?? ""}>
                    {r[h] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="button" variant="accent" onClick={onNext} disabled={!!busy}>
          {busy ?? "Next: create Airtable base"}
        </Button>
      </div>
    </div>
  );
}

function ConfidenceChip({ level }: { level: "high" | "medium" | "low" }) {
  const variant = level === "high" ? "success" : level === "medium" ? "warning" : "secondary";
  return <Badge variant={variant}>{level}</Badge>;
}

function ProvisionStep({
  mode,
  onModeChange,
  workspaceId,
  onWorkspaceChange,
  bases,
  existingBaseId,
  onBaseChange,
  onProvision,
  result,
  busy,
  districtName,
  loaded,
}: {
  mode: "existing" | "create";
  onModeChange(m: "existing" | "create"): void;
  workspaceId: string;
  onWorkspaceChange(id: string): void;
  bases: Array<{ id: string; name: string; permissionLevel?: string }>;
  existingBaseId: string;
  onBaseChange(id: string): void;
  onProvision(): void;
  result: { base_id: string; reused: boolean } | null;
  busy: string | null;
  districtName: string;
  loaded: boolean;
}) {
  const editableBases = bases.filter(
    (b) => !b.permissionLevel || b.permissionLevel === "create" || b.permissionLevel === "edit",
  );
  const canCreate =
    mode === "existing"
      ? Boolean(existingBaseId)
      : /^wsp[A-Za-z0-9]+$/.test(workspaceId);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-4">
      <div>
        <h2 className="font-medium text-navy-900">Install the canonical schema</h2>
        <p className="text-xs text-muted-foreground">
          We&apos;ll add four tables — Voters, Households, Knocks, Conversations — plus the
          linked-record fields between them.
        </p>
      </div>

      {result ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          Base ready: <span className="font-mono">{result.base_id}</span>
          {result.reused ? " (reused existing)" : " (installed just now)"}
        </div>
      ) : null}

      {!result ? (
        <div className="space-y-4">
          <div className="inline-flex rounded-md border border-border bg-navy-50/40 p-0.5">
            <ModeButton active={mode === "existing"} onClick={() => onModeChange("existing")}>
              Use an existing base
            </ModeButton>
            <ModeButton active={mode === "create"} onClick={() => onModeChange("create")}>
              Create a new base
            </ModeButton>
          </div>

          {mode === "existing" ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-navy-700">
              Pick a base
              <select
                className="w-full rounded-md border border-navy-200 bg-white px-2 py-2 text-sm text-navy-900 focus:border-navy-400 focus:outline-none"
                value={existingBaseId}
                onChange={(e) => onBaseChange(e.target.value)}
                disabled={!loaded || editableBases.length === 0}
              >
                <option value="">
                  {!loaded
                    ? "Loading your bases…"
                    : editableBases.length === 0
                      ? "No editable bases visible to this token"
                      : "Select a base…"}
                </option>
                {editableBases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.permissionLevel ? `(${b.permissionLevel})` : ""}
                  </option>
                ))}
              </select>
              <span className="text-[11px] font-normal text-muted-foreground">
                We&rsquo;ll drop the four tables into this base. If the base already has tables
                named <span className="font-mono">Voters</span>, <span className="font-mono">Households</span>,
                <span className="font-mono"> Knocks</span> or <span className="font-mono">Conversations</span>,
                the install aborts so we don&rsquo;t clobber your data.
              </span>
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-xs font-medium text-navy-700">
              Workspace ID
              <input
                type="text"
                className="w-full rounded-md border border-navy-200 bg-white px-2 py-2 font-mono text-sm text-navy-900 focus:border-navy-400 focus:outline-none"
                value={workspaceId}
                onChange={(e) => onWorkspaceChange(e.target.value.trim())}
                placeholder="wspXXXXXXXXXXX"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <span className="text-[11px] font-normal text-muted-foreground">
                Airtable doesn&rsquo;t expose a workspace list via their API. Open Airtable in a
                new tab — your workspace id is the <span className="font-mono">wsp…</span>{" "}
                segment in the URL (<span className="font-mono">airtable.com/wspXXXXX/home</span>).
                We&rsquo;ll create a base named{" "}
                <span className="font-mono">{districtName} — Voters</span> in it.
                {loaded && workspaceId ? " Pre-filled from your saved credentials." : ""}
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="accent" onClick={onProvision} disabled={!canCreate || !!busy}>
              {busy ??
                (mode === "existing" ? "Install tables in this base" : "Create base")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1 text-xs font-medium transition ${
        active ? "bg-white text-navy-900 shadow-sm" : "text-navy-600 hover:text-navy-900"
      }`}
    >
      {children}
    </button>
  );
}

function ImportJobProgress({ job }: { job: ImportJobSnapshot }) {
  const phaseLabel: Record<ImportJobSnapshot["status"], string> = {
    queued: "Waiting to start…",
    pushing: "Pushing rows to Airtable…",
    pushed: "Airtable sync complete — starting import…",
    importing: "Importing + geocoding…",
    imported: "Done.",
    failed: "Failed.",
    paused: "Paused.",
  };
  const total = Math.max(job.rows_total, 1);
  const pushedPct = Math.min(100, Math.round((job.rows_pushed / total) * 100));
  const importedPct = Math.min(100, Math.round((job.rows_imported / total) * 100));
  const elapsed = job.started_at
    ? Math.max(0, Math.round((Date.now() - new Date(job.started_at).getTime()) / 1000))
    : 0;
  return (
    <div className="space-y-3 rounded-md border border-navy-100 bg-navy-50/40 p-3 text-xs">
      <div className="flex items-center justify-between text-navy-900">
        <span className="font-semibold">{phaseLabel[job.status]}</span>
        {job.started_at && job.status !== "imported" && job.status !== "failed" ? (
          <span className="text-[10px] text-muted-foreground">
            {Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed
          </span>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Airtable push</span>
          <span>
            {job.rows_pushed.toLocaleString()} / {job.rows_total.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100">
          <div
            className="h-full bg-navy-900 transition-all"
            style={{ width: `${pushedPct}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            Supabase import · {job.rows_geocoded.toLocaleString()} geocoded
            {job.rows_failed > 0 ? ` · ${job.rows_failed.toLocaleString()} skipped` : ""}
          </span>
          <span>
            {job.rows_imported.toLocaleString()} / {job.rows_total.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${importedPct}%` }}
          />
        </div>
      </div>

      {job.status === "failed" && job.error_message ? (
        <p className="rounded bg-crimson/10 px-2 py-1 text-[11px] text-crimson">
          {job.error_message}
        </p>
      ) : null}
    </div>
  );
}
