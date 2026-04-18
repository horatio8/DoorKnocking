"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_FIELDS, type FieldMapping } from "@/lib/airtable/mapping";
import type { AirtableField } from "@/lib/airtable/metadata";

interface Props {
  districtId: string;
  districtName: string;
  initialBaseId: string;
  initialTableId: string;
  initialMapping: FieldMapping | null;
  status: string;
  lastImportedAt: string | null;
  lastError: string | null;
  lastSummary: Record<string, unknown> | null;
  lastRelative: string;
}

interface DiscoveredTable {
  id: string;
  name: string;
  fields: AirtableField[];
}

interface DiscoveredBase {
  id: string;
  name: string;
}

interface Proposal {
  mapping: FieldMapping;
  confidence: Record<string, "high" | "medium" | "low">;
  reasoning: Record<string, string>;
  unmapped_airtable_fields: string[];
  warnings: string[];
}

const STEP_ORDER = ["connect", "review", "preview", "import"] as const;
type Step = (typeof STEP_ORDER)[number];

export function AirtableConnectionWizard(props: Props) {
  const router = useRouter();
  const [baseId, setBaseId] = useState(props.initialBaseId);
  const [tableId, setTableId] = useState(props.initialTableId);
  const [tables, setTables] = useState<DiscoveredTable[] | null>(null);
  const [selectedTable, setSelectedTable] = useState<DiscoveredTable | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(
    props.initialMapping
      ? {
          mapping: props.initialMapping,
          confidence: {},
          reasoning: {},
          unmapped_airtable_fields: [],
          warnings: [],
        }
      : null,
  );
  const [mapping, setMapping] = useState<FieldMapping>(props.initialMapping ?? {});
  const [previewRows, setPreviewRows] = useState<unknown[] | null>(null);
  const [bases, setBases] = useState<DiscoveredBase[] | null>(null);
  const [loadingBases, setLoadingBases] = useState(false);
  const [basesError, setBasesError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(props.initialMapping ? "review" : "connect");

  useEffect(() => {
    setBaseId(props.initialBaseId);
    setTableId(props.initialTableId);
    setMapping(props.initialMapping ?? {});
    setProposal(
      props.initialMapping
        ? { mapping: props.initialMapping, confidence: {}, reasoning: {}, unmapped_airtable_fields: [], warnings: [] }
        : null,
    );
    setStep(props.initialMapping ? "review" : "connect");
    setTables(null);
    setSelectedTable(null);
    setPreviewRows(null);
    setError(null);
  }, [props.districtId, props.initialBaseId, props.initialTableId, props.initialMapping]);

  async function loadBases() {
    setLoadingBases(true);
    setBasesError(null);
    try {
      const res = await fetch(
        `/api/admin/airtable/discover?districtId=${encodeURIComponent(props.districtId)}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setBases((body.bases as DiscoveredBase[]) ?? []);
    } catch (e) {
      setBasesError((e as Error).message);
    } finally {
      setLoadingBases(false);
    }
  }

  useEffect(() => {
    setBases(null);
    loadBases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.districtId]);

  useEffect(() => {
    if (!baseId) {
      setTables(null);
      setSelectedTable(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy("Loading tables…");
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/airtable/discover?baseId=${encodeURIComponent(baseId)}&districtId=${encodeURIComponent(props.districtId)}`,
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `${res.status}`);
        if (cancelled) return;
        setTables(body.tables);
        const match = (body.tables as DiscoveredTable[]).find((t) => t.id === tableId) ?? null;
        setSelectedTable(match);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // tableId intentionally excluded — we only refetch when baseId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseId, props.districtId]);

  async function suggestMapping() {
    if (!baseId || !tableId) return;
    setBusy("Asking Claude to propose a mapping…");
    setError(null);
    try {
      const res = await fetch("/api/admin/airtable/suggest-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseId, tableId, districtId: props.districtId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setSelectedTable({ id: body.table.id, name: body.table.name, fields: body.table.fields });
      setProposal(body.proposal);
      setMapping(body.proposal.mapping);
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveMapping() {
    setBusy("Saving mapping…");
    setError(null);
    try {
      const res = await fetch("/api/admin/airtable/save", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ districtId: props.districtId, baseId, tableId, mapping }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function loadPreview() {
    setBusy("Pulling 5 sample rows…");
    setError(null);
    try {
      const res = await fetch("/api/admin/airtable/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseId, tableId, mapping, limit: 5, districtId: props.districtId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setPreviewRows(body.rows);
      setStep("preview");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runFullImport() {
    if (!confirm("Run a full import from Airtable? This will upsert every row.")) return;
    setBusy("Importing…");
    setError(null);
    try {
      const res = await fetch("/api/admin/airtable/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ districtId: props.districtId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-navy-500">{props.districtName}</p>
            <p className="text-sm text-muted-foreground">
              Status: <strong className="capitalize">{props.status.replace("_", " ")}</strong>
              {props.lastImportedAt ? ` · last imported ${props.lastRelative}` : ""}
            </p>
          </div>
          {props.lastSummary ? (
            <p className="text-xs text-muted-foreground">
              {Object.entries(props.lastSummary as Record<string, unknown>).map(([k, v]) => `${k}=${String(v)}`).join(" · ")}
            </p>
          ) : null}
        </div>
        {props.lastError ? (
          <p className="mt-2 rounded-md bg-crimson/10 px-3 py-2 text-xs text-crimson">{props.lastError}</p>
        ) : null}
      </div>

      <Stepper current={step} />

      {step === "connect" || !proposal ? (
        <ConnectStep
          districtId={props.districtId}
          baseId={baseId}
          tableId={tableId}
          tables={tables}
          bases={bases}
          loadingBases={loadingBases}
          basesError={basesError}
          onBaseIdChange={(v) => {
            setBaseId(v);
            setTableId("");
          }}
          onTableIdChange={setTableId}
          onReloadBases={loadBases}
          onSuggest={suggestMapping}
          busy={busy}
        />
      ) : null}

      {step === "review" && proposal && selectedTable ? (
        <ReviewStep
          table={selectedTable}
          proposal={proposal}
          mapping={mapping}
          onChange={(field, value) => setMapping((m) => ({ ...m, [field]: value }))}
          onBack={() => setStep("connect")}
          onSave={saveMapping}
          onPreview={loadPreview}
          busy={busy}
        />
      ) : null}

      {step === "preview" && previewRows ? (
        <PreviewStep
          rows={previewRows}
          onBack={() => setStep("review")}
          onSave={saveMapping}
          onImport={runFullImport}
          busy={busy}
        />
      ) : null}

      {error ? (
        <p className="rounded-md bg-crimson/10 px-3 py-2 text-sm text-crimson">{error}</p>
      ) : null}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const labels: Record<Step, string> = {
    connect: "1. Connect base",
    review: "2. Review mapping",
    preview: "3. Preview rows",
    import: "4. Import",
  };
  const order = STEP_ORDER;
  const idx = order.indexOf(current);
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {order.map((s, i) => (
        <span
          key={s}
          className={`rounded-full px-3 py-1 ${
            i <= idx ? "bg-navy text-white" : "bg-navy-50 text-navy-500"
          }`}
        >
          {labels[s]}
        </span>
      ))}
    </div>
  );
}

function ConnectStep({
  districtId,
  baseId,
  tableId,
  tables,
  bases,
  loadingBases,
  basesError,
  onBaseIdChange,
  onTableIdChange,
  onReloadBases,
  onSuggest,
  busy,
}: {
  districtId: string;
  baseId: string;
  tableId: string;
  tables: DiscoveredTable[] | null;
  bases: DiscoveredBase[] | null;
  loadingBases: boolean;
  basesError: string | null;
  onBaseIdChange(v: string): void;
  onTableIdChange(v: string): void;
  onReloadBases(): void;
  onSuggest(): void;
  busy: string | null;
}) {
  const selectClass =
    "w-full rounded-md border border-navy-200 bg-white px-2 py-2 text-sm text-navy-900 focus:border-navy-400 focus:outline-none disabled:bg-navy-50 disabled:text-muted-foreground";
  const tablePlaceholder = !baseId
    ? "Pick a base first"
    : !tables
      ? "Loading tables…"
      : tables.length === 0
        ? "(no tables in this base)"
        : "Select a table…";
  const returnTo = `/admin/airtable?district=${encodeURIComponent(districtId)}`;
  const connectUrl = `/api/airtable/oauth/start?districtId=${encodeURIComponent(districtId)}&returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-4">
      <h2 className="font-medium text-navy-900">Connect an Airtable base</h2>
      <p className="text-xs text-muted-foreground">
        Pick the base and voter table from your Airtable workspace. The list
        comes from whichever Airtable account is connected for this client.
      </p>

      {basesError ? (
        <div className="space-y-2 rounded border border-crimson/30 bg-crimson/5 p-3 text-xs text-crimson">
          <p>Couldn&apos;t load bases: {basesError}</p>
          <div className="flex gap-2">
            <a
              href={connectUrl}
              className="rounded-md bg-navy-900 px-3 py-1.5 font-medium text-white hover:bg-navy-800"
            >
              Connect Airtable
            </a>
            <button
              type="button"
              onClick={onReloadBases}
              className="rounded-md border border-navy-200 bg-white px-3 py-1.5 font-medium text-navy-700 hover:bg-navy-50"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-navy-700">
          Base
          <select
            className={selectClass}
            value={baseId}
            onChange={(e) => onBaseIdChange(e.target.value)}
            disabled={loadingBases || !bases || !!basesError}
          >
            <option value="">
              {loadingBases
                ? "Loading your bases…"
                : bases && bases.length === 0
                  ? "(no bases visible to this PAT)"
                  : "Select a base…"}
            </option>
            {(bases ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-navy-700">
          Voter table
          <select
            className={selectClass}
            value={tableId}
            onChange={(e) => onTableIdChange(e.target.value)}
            disabled={!baseId || !tables || tables.length === 0}
          >
            <option value="">{tablePlaceholder}</option>
            {(tables ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.fields.length} fields)
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onSuggest} disabled={!baseId || !tableId || !!busy} variant="accent">
          {busy ?? "Ask Claude to propose mapping"}
        </Button>
        <a href={connectUrl} className="text-xs text-muted-foreground underline">
          Connect a different Airtable account
        </a>
      </div>
    </div>
  );
}

function ReviewStep({
  table,
  proposal,
  mapping,
  onChange,
  onBack,
  onSave,
  onPreview,
  busy,
}: {
  table: DiscoveredTable;
  proposal: Proposal;
  mapping: FieldMapping;
  onChange(field: string, value: string | null): void;
  onBack(): void;
  onSave(): void;
  onPreview(): void;
  busy: string | null;
}) {
  const grouped = PLATFORM_FIELDS.reduce<Record<string, typeof PLATFORM_FIELDS>>((acc, f) => {
    (acc[f.group] ||= []).push(f);
    return acc;
  }, {});
  const groupOrder = ["identity", "name", "address", "contact", "party", "metadata"];

  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-4">
      <div>
        <h2 className="font-medium text-navy-900">Review mapping</h2>
        <p className="text-xs text-muted-foreground">
          Source: <span className="font-mono">{table.name}</span> · {table.fields.length} fields.
          Adjust any row, then save and preview.
        </p>
      </div>

      {proposal.warnings.length > 0 ? (
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
                  const conf = proposal.confidence[pf.key];
                  const reason = proposal.reasoning[pf.key];
                  return (
                    <tr key={pf.key} className="border-b border-border last:border-0">
                      <td className="w-1/3 py-2 align-top">
                        <div className="font-medium text-navy-900">
                          {pf.label}{" "}
                          {pf.required ? <span className="text-crimson">*</span> : null}
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
                          {table.fields.map((af) => (
                            <option key={af.id} value={af.name}>
                              {af.name} ({af.type})
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

      {proposal.unmapped_airtable_fields.length > 0 ? (
        <p className="rounded border border-dashed border-border p-2 text-xs text-muted-foreground">
          Unmapped Airtable fields: {proposal.unmapped_airtable_fields.join(", ")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="button" variant="outline" onClick={onSave} disabled={!!busy}>
          {busy === "Saving mapping…" ? busy : "Save mapping"}
        </Button>
        <Button type="button" onClick={onPreview} disabled={!!busy} variant="accent">
          {busy === "Pulling 5 sample rows…" ? busy : "Preview 5 rows"}
        </Button>
      </div>
    </div>
  );
}

function ConfidenceChip({ level }: { level: "high" | "medium" | "low" }) {
  const variant = level === "high" ? "success" : level === "medium" ? "warning" : "secondary";
  return <Badge variant={variant}>{level}</Badge>;
}

function PreviewStep({
  rows,
  onBack,
  onSave,
  onImport,
  busy,
}: {
  rows: unknown[];
  onBack(): void;
  onSave(): void;
  onImport(): void;
  busy: string | null;
}) {
  const typed = rows as Array<{
    airtable_id: string;
    voter: Record<string, unknown> | null;
    household: Record<string, unknown> | null;
  }>;

  const voterKeys = uniqueKeys(typed.map((r) => r.voter));
  const householdKeys = uniqueKeys(typed.map((r) => r.household));

  return (
    <div className="space-y-3 rounded-lg border border-border bg-white p-4">
      <h2 className="font-medium text-navy-900">Preview</h2>
      <p className="text-xs text-muted-foreground">
        Below is what {rows.length} sample Airtable rows look like after mapping. Confirm the data
        looks right, then run a full import.
      </p>

      <div className="max-h-[420px] overflow-auto rounded border border-border">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-navy-50 text-left text-navy-700">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-20 bg-navy-50 px-2 py-1">#</th>
              <th rowSpan={2} className="bg-navy-50 px-2 py-1">airtable_id</th>
              {voterKeys.length > 0 ? (
                <th
                  colSpan={voterKeys.length}
                  className="border-l border-navy-200 bg-navy-100 px-2 py-1 text-center font-semibold uppercase tracking-widest text-[10px]"
                >
                  voter
                </th>
              ) : null}
              {householdKeys.length > 0 ? (
                <th
                  colSpan={householdKeys.length}
                  className="border-l border-navy-200 bg-navy-100 px-2 py-1 text-center font-semibold uppercase tracking-widest text-[10px]"
                >
                  household
                </th>
              ) : null}
            </tr>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-navy-500">
              {voterKeys.map((k, i) => (
                <th
                  key={`v-${k}`}
                  className={`${i === 0 ? "border-l border-navy-200" : ""} bg-navy-50 px-2 py-1 font-medium`}
                >
                  {k}
                </th>
              ))}
              {householdKeys.map((k, i) => (
                <th
                  key={`h-${k}`}
                  className={`${i === 0 ? "border-l border-navy-200" : ""} bg-navy-50 px-2 py-1 font-medium`}
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typed.map((r, i) => (
              <tr key={r.airtable_id ?? i} className="border-t border-border odd:bg-white even:bg-navy-50/30">
                <td className="sticky left-0 bg-inherit px-2 py-1 text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{r.airtable_id}</td>
                {voterKeys.map((k, j) => {
                  const display = fmtCell(r.voter?.[k]);
                  return (
                    <td
                      key={`v-${k}`}
                      className={`${j === 0 ? "border-l border-border" : ""} max-w-[220px] truncate px-2 py-1`}
                      title={display}
                    >
                      {display}
                    </td>
                  );
                })}
                {householdKeys.map((k, j) => {
                  const display = fmtCell(r.household?.[k]);
                  return (
                    <td
                      key={`h-${k}`}
                      className={`${j === 0 ? "border-l border-border" : ""} max-w-[220px] truncate px-2 py-1`}
                      title={display}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onBack}>Back to mapping</Button>
        <Button type="button" variant="outline" onClick={onSave} disabled={!!busy}>
          Save mapping
        </Button>
        <Button type="button" onClick={onImport} disabled={!!busy} variant="accent">
          {busy === "Importing…" ? busy : "Run full import"}
        </Button>
      </div>
    </div>
  );
}

function uniqueKeys(objs: Array<Record<string, unknown> | null | undefined>): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const obj of objs) {
    if (!obj) continue;
    for (const key of Object.keys(obj)) {
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    }
  }
  return order;
}

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.map((x) => (x == null ? "" : String(x))).join(", ");
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
