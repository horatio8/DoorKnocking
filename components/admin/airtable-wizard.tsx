"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  async function discoverTables() {
    setBusy("Loading tables…");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/airtable/discover?baseId=${encodeURIComponent(baseId)}&districtId=${encodeURIComponent(props.districtId)}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setTables(body.tables);
      const match = body.tables.find((t: DiscoveredTable) => t.id === tableId) ?? null;
      setSelectedTable(match);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

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
          baseId={baseId}
          tableId={tableId}
          tables={tables}
          onBaseIdChange={setBaseId}
          onTableIdChange={setTableId}
          onDiscover={discoverTables}
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
  baseId,
  tableId,
  tables,
  onBaseIdChange,
  onTableIdChange,
  onDiscover,
  onSuggest,
  busy,
}: {
  baseId: string;
  tableId: string;
  tables: DiscoveredTable[] | null;
  onBaseIdChange(v: string): void;
  onTableIdChange(v: string): void;
  onDiscover(): void;
  onSuggest(): void;
  busy: string | null;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-4">
      <h2 className="font-medium text-navy-900">Connect an Airtable base</h2>
      <p className="text-xs text-muted-foreground">
        Paste the base ID (starts with <code>app…</code>) and the voter table ID
        (starts with <code>tbl…</code>). The Personal Access Token configured
        for the platform must have read access to this base.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          placeholder="appz0KOPIaQFCxxw3"
          value={baseId}
          onChange={(e) => onBaseIdChange(e.target.value)}
        />
        <Input
          placeholder="tblCpmh6G97Zy5S8P"
          value={tableId}
          onChange={(e) => onTableIdChange(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onDiscover} disabled={!baseId || !!busy}>
          List tables in base
        </Button>
        <Button type="button" onClick={onSuggest} disabled={!baseId || !tableId || !!busy} variant="accent">
          {busy ?? "Ask Claude to propose mapping"}
        </Button>
      </div>
      {tables ? (
        <div className="space-y-1 rounded border border-navy-100 bg-navy-50/40 p-3 text-xs">
          <p className="font-semibold text-navy-700">Tables in base:</p>
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => onTableIdChange(t.id)}
              className={`block w-full rounded px-2 py-1 text-left hover:bg-white ${
                t.id === tableId ? "bg-white font-medium" : ""
              }`}
            >
              <span className="font-mono">{t.id}</span> — {t.name} · {t.fields.length} fields
            </button>
          ))}
        </div>
      ) : null}
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
  return (
    <div className="space-y-3 rounded-lg border border-border bg-white p-4">
      <h2 className="font-medium text-navy-900">Preview</h2>
      <p className="text-xs text-muted-foreground">
        Below is what {rows.length} sample Airtable rows look like after mapping. Confirm the data
        looks right, then run a full import.
      </p>
      <pre className="max-h-[420px] overflow-auto rounded bg-navy-900 p-3 text-[11px] text-navy-50">
        {JSON.stringify(rows, null, 2)}
      </pre>
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
