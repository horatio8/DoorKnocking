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
  // Airtable doesn't expose a workspaces-list endpoint, so we load the
  // saved workspace id (if any) on mount and let the admin paste in a
  // new one. Workspace ids look like wspXXXXXXXXXXX and live in the
  // URL of any Airtable workspace page.
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{ base_id: string; reused: boolean } | null>(
    hasCanonicalBase ? { base_id: "(already provisioned)", reused: true } : null,
  );
  const [pushSummary, setPushSummary] = useState<string | null>(null);
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

  // Pull the saved workspace id on mount so the admin doesn't have to
  // re-find it on every provision attempt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/airtable/provision?district_id=${encodeURIComponent(districtId)}`,
        );
        const body = await res.json();
        if (!cancelled && res.ok && body.suggested) setWorkspaceId(body.suggested);
      } catch {
        // Non-fatal — the admin can still paste their workspace id.
      } finally {
        if (!cancelled) setWorkspaceLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [districtId]);

  async function provisionBase() {
    if (!workspaceId) {
      setError("Pick a workspace first");
      return;
    }
    setBusy("Creating base + four tables…");
    setError(null);
    try {
      const res = await fetch("/api/admin/airtable/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district_id: districtId, workspace_id: workspaceId }),
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
    setBusy("Pushing rows to Airtable + Supabase…");
    setError(null);
    try {
      const res = await fetch("/api/admin/airtable/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import_file_id: uploadState.import_file.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setPushSummary(
        `Pushed ${body.pushed ?? "?"} Airtable rows · imported ${body.imported ?? "?"} voters`,
      );
      setStep("done");
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
          workspaceId={workspaceId}
          onPick={setWorkspaceId}
          onProvision={provisionBase}
          result={provisionResult}
          busy={busy}
          districtName={districtName}
          loaded={workspaceLoaded}
        />
      ) : null}

      {step === "push" ? (
        <div className="space-y-3 rounded-lg border border-border bg-white p-4">
          <h2 className="font-medium text-navy-900">Push {uploadState?.import_file.row_count ?? "?"} rows</h2>
          <p className="text-xs text-muted-foreground">
            Pushes to the canonical Airtable base and upserts into the
            platform database in one pass.
          </p>
          {provisionResult ? (
            <p className="text-[11px] text-muted-foreground">
              Target base: <span className="font-mono">{provisionResult.base_id}</span>
              {provisionResult.reused ? " · reused existing" : " · created just now"}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("review")}>
              Back
            </Button>
            <Button type="button" variant="accent" onClick={pushRows} disabled={!!busy}>
              {busy ?? "Push rows"}
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
  const groupOrder = ["identity", "name", "address", "contact", "party", "metadata"];
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
  workspaceId,
  onPick,
  onProvision,
  result,
  busy,
  districtName,
  loaded,
}: {
  workspaceId: string;
  onPick(id: string): void;
  onProvision(): void;
  result: { base_id: string; reused: boolean } | null;
  busy: string | null;
  districtName: string;
  loaded: boolean;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-4">
      <div>
        <h2 className="font-medium text-navy-900">Create the Airtable base</h2>
        <p className="text-xs text-muted-foreground">
          We&apos;ll create a new base named{" "}
          <span className="font-mono">{districtName} — Voters</span> with four
          tables: Voters, Households, Knocks, Conversations.
        </p>
      </div>

      {result ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          Base ready: <span className="font-mono">{result.base_id}</span>
          {result.reused ? " (reused existing)" : " (freshly created)"}
        </div>
      ) : null}

      {!result ? (
        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-navy-700">
            Workspace ID
            <input
              type="text"
              className="w-full rounded-md border border-navy-200 bg-white px-2 py-2 font-mono text-sm text-navy-900 focus:border-navy-400 focus:outline-none"
              value={workspaceId}
              onChange={(e) => onPick(e.target.value.trim())}
              placeholder="wspXXXXXXXXXXX"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <span className="text-[11px] font-normal text-muted-foreground">
              Airtable doesn&rsquo;t expose a workspace list via their API. Open Airtable in a new
              tab — your workspace id is the{" "}
              <span className="font-mono">wsp…</span> segment in the URL
              (<span className="font-mono">airtable.com/wspXXXXX/home</span>). Paste it here.
              {loaded && workspaceId ? " Pre-filled from your saved credentials." : ""}
            </span>
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="accent"
              onClick={onProvision}
              disabled={!/^wsp[A-Za-z0-9]+$/.test(workspaceId) || !!busy}
            >
              {busy ?? "Create base"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
