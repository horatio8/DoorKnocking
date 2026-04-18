"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { AirtableCredentialsCard } from "@/components/admin/airtable-credentials-card";
import { AirtableConnectionWizard } from "@/components/admin/airtable-wizard";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/utils";
import type {
  SetupDistrictSummary,
  SetupStatus,
  SetupStepId,
} from "@/lib/setup/status";

interface Props {
  status: SetupStatus;
}

const VISIBLE_STEPS: SetupStepId[] = [
  "client",
  "district",
  "airtable_token",
  "airtable_mapping",
  "users",
  "done",
];

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SetupWizard({ status }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<SetupStepId>(status.firstIncomplete);

  const steps = useMemo(() => {
    const byId = new Map(status.steps.map((s) => [s.id, s]));
    return VISIBLE_STEPS.map((id) => {
      if (id === "done") {
        return {
          id,
          label: "Finish",
          complete: status.allComplete,
        };
      }
      const s = byId.get(id)!;
      return { id: s.id, label: s.label, complete: s.complete };
    });
  }, [status]);

  const currentIdx = VISIBLE_STEPS.indexOf(current);

  function goto(id: SetupStepId) {
    setCurrent(id);
  }

  function advance() {
    const next = VISIBLE_STEPS[currentIdx + 1];
    if (next) setCurrent(next);
    router.refresh();
  }

  function back() {
    const prev = VISIBLE_STEPS[currentIdx - 1];
    if (prev) setCurrent(prev);
  }

  return (
    <div className="space-y-6">
      <Stepper
        items={steps.map((s) => ({ id: s.id, label: s.label, complete: s.complete }))}
        currentId={current}
        onSelect={(id) => goto(id as SetupStepId)}
      />

      {current === "client" ? (
        <ClientStep status={status} onDone={advance} />
      ) : null}

      {current === "district" ? (
        <DistrictStep status={status} onDone={advance} onBack={back} />
      ) : null}

      {current === "airtable_token" ? (
        <TokenStep status={status} onDone={advance} onBack={back} />
      ) : null}

      {current === "airtable_mapping" ? (
        <MappingStep status={status} onDone={advance} onBack={back} />
      ) : null}

      {current === "users" ? (
        <UsersStep status={status} onDone={advance} onBack={back} />
      ) : null}

      {current === "done" ? <DoneStep status={status} onBack={back} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Client profile
// ---------------------------------------------------------------------------

function ClientStep({ status, onDone }: { status: SetupStatus; onDone: () => void }) {
  const router = useRouter();
  const existing = status.client;

  const [form, setForm] = useState({
    slug: "",
    name: "",
    contact_email: "",
    short_name: "",
    primary_color: "#0B1F3A",
    accent_color: "#B5121B",
    district_slug: "",
    district_name: "",
    district_country: "US",
    district_region: "",
    timezone: "America/New_York",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existing) {
    return (
      <StepCard
        title="Client profile"
        description="This campaign is already configured. You can tweak brand colors later on the Clients page."
      >
        <div className="grid gap-3 rounded-md border border-border bg-navy-50/40 p-4 text-sm md:grid-cols-2">
          <Detail label="Name" value={existing.name} />
          <Detail label="Slug" value={<span className="font-mono">{existing.slug}</span>} />
          <Detail label="Contact email" value={existing.contact_email ?? "—"} />
          <Detail label="Short name" value={existing.brand?.short_name ?? "—"} />
          <Detail
            label="Primary"
            value={
              <Swatch color={existing.brand?.primary_color ?? "#0B1F3A"} />
            }
          />
          <Detail
            label="Accent"
            value={<Swatch color={existing.brand?.accent_color ?? "#B5121B"} />}
          />
        </div>
        <StepActions
          right={
            <>
              {status.canCreateClient ? (
                <Button asChild variant="outline">
                  <Link href="/admin/clients">Manage clients</Link>
                </Button>
              ) : null}
              <Button onClick={onDone} variant="accent">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          }
        />
      </StepCard>
    );
  }

  if (!status.canCreateClient) {
    return (
      <StepCard
        title="Client profile"
        description="Open a client subdomain or ask a super-admin to create this campaign first."
      >
        <p className="text-sm text-muted-foreground">
          Only super-admins can create new clients. If you think this is a mistake, make sure you
          loaded the wizard from the correct subdomain (e.g. <code>macarthur.campaignos.com/admin/setup</code>).
        </p>
      </StepCard>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Failed (${res.status})`);
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <StepCard
      title="Create the client"
      description="Set up a new campaign. This also creates the campaign's first district — you can add more districts later."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <SectionHeading>Campaign</SectionHeading>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Slug" hint="Lowercase + hyphens. Appears in the subdomain.">
            <Input
              required
              placeholder="e.g. macarthur"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: normalizeSlug(e.target.value) })}
            />
          </Field>
          <Field label="Name">
            <Input
              required
              placeholder="Macarthur '26"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Short name" hint="Shown in the in-app header if set.">
            <Input
              placeholder="Macarthur"
              value={form.short_name}
              onChange={(e) => setForm({ ...form, short_name: e.target.value })}
            />
          </Field>
          <Field label="Contact email">
            <Input
              type="email"
              placeholder="ops@example.com"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
          </Field>
          <Field label="Primary color">
            <input
              type="color"
              value={form.primary_color}
              onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              className="h-10 w-20 cursor-pointer rounded border border-input bg-transparent"
            />
          </Field>
          <Field label="Accent color">
            <input
              type="color"
              value={form.accent_color}
              onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
              className="h-10 w-20 cursor-pointer rounded border border-input bg-transparent"
            />
          </Field>
        </div>

        <SectionHeading>First district</SectionHeading>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="District slug" hint="Globally unique, lowercase + hyphens.">
            <Input
              required
              placeholder="e.g. au-macarthur"
              value={form.district_slug}
              onChange={(e) => setForm({ ...form, district_slug: normalizeSlug(e.target.value) })}
            />
          </Field>
          <Field label="District name">
            <Input
              required
              placeholder="Macarthur"
              value={form.district_name}
              onChange={(e) => setForm({ ...form, district_name: e.target.value })}
            />
          </Field>
          <Field label="Country">
            <Input
              required
              placeholder="US"
              value={form.district_country}
              onChange={(e) => setForm({ ...form, district_country: e.target.value })}
            />
          </Field>
          <Field label="Region" hint="State code (US) or electorate (AU).">
            <Input
              required
              placeholder="NSW"
              value={form.district_region}
              onChange={(e) => setForm({ ...form, district_region: e.target.value })}
            />
          </Field>
          <Field label="Timezone">
            <Input
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </Field>
        </div>

        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        <StepActions
          right={
            <Button type="submit" disabled={busy} variant="accent">
              {busy ? "Creating…" : (
                <>
                  Create client <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          }
        />
      </form>
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — District (create additional or confirm existing)
// ---------------------------------------------------------------------------

function DistrictStep({
  status,
  onDone,
  onBack,
}: {
  status: SetupStatus;
  onDone: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(status.districts.length === 0);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    country: "US",
    region: "",
    timezone: "America/New_York",
    default_walkbook_size: 20,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!status.client) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: insertError } = await supabase
      .from("districts")
      .insert({ ...form, client_id: status.client.id });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setAdding(false);
    setForm({
      slug: "",
      name: "",
      country: "US",
      region: "",
      timezone: "America/New_York",
      default_walkbook_size: 20,
    });
    router.refresh();
  }

  return (
    <StepCard
      title="Districts"
      description="Each district is a scoped voter universe with its own Airtable base. Most campaigns start with one."
    >
      {status.districts.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
              <tr>
                <th className="px-3 py-2 text-left">Slug</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Country / region</th>
                <th className="px-3 py-2 text-left">Airtable</th>
              </tr>
            </thead>
            <tbody>
              {status.districts.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{d.slug}</td>
                  <td className="px-3 py-2">{d.name}</td>
                  <td className="px-3 py-2">
                    {d.country ?? "—"} · {d.region ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <AirtableStatusBadge status={d.airtable_import_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {adding ? (
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Field label="Slug">
            <Input
              required
              placeholder="au-macarthur"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: normalizeSlug(e.target.value) })}
            />
          </Field>
          <Field label="Name">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Country">
            <Input
              required
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </Field>
          <Field label="Region">
            <Input
              required
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
          </Field>
          <Field label="Timezone">
            <Input
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </Field>
          <Field label="Default walkbook size">
            <Input
              type="number"
              value={form.default_walkbook_size}
              onChange={(e) =>
                setForm({ ...form, default_walkbook_size: Number(e.target.value) })
              }
            />
          </Field>

          {error ? (
            <div className="md:col-span-2">
              <ErrorBanner>{error}</ErrorBanner>
            </div>
          ) : null}

          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Add district"}
            </Button>
            {status.districts.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAdding(true)}>
            Add another district
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/districts">
              Manage districts <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}

      <StepActions
        left={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
        right={
          <Button
            onClick={onDone}
            variant="accent"
            disabled={status.districts.length === 0}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Airtable token
// ---------------------------------------------------------------------------

function TokenStep({
  status,
  onDone,
  onBack,
}: {
  status: SetupStatus;
  onDone: () => void;
  onBack: () => void;
}) {
  if (!status.client) {
    return (
      <StepCard title="Airtable credentials">
        <p className="text-sm text-muted-foreground">Finish creating the client first.</p>
        <StepActions
          left={
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          }
        />
      </StepCard>
    );
  }

  return (
    <StepCard
      title="Airtable credentials"
      description="Paste a Personal Access Token with read+write on the voter base. You can rotate it later from Settings."
    >
      <AirtableCredentialsCard
        clientId={status.client.id}
        clientName={status.client.name}
        hasToken={status.airtable.has_token}
        workspaceId={status.airtable.workspace_id}
        verifiedAt={status.airtable.verified_at}
      />

      <StepActions
        left={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
        right={
          <Button
            onClick={onDone}
            variant="accent"
            disabled={!status.airtable.has_token}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Airtable mapping
// ---------------------------------------------------------------------------

function MappingStep({
  status,
  onDone,
  onBack,
}: {
  status: SetupStatus;
  onDone: () => void;
  onBack: () => void;
}) {
  const [districtId, setDistrictId] = useState<string>(
    status.primaryDistrict?.id ?? "",
  );
  const selected =
    status.districts.find((d) => d.id === districtId) ?? status.primaryDistrict;

  if (!status.client || !selected) {
    return (
      <StepCard title="Airtable mapping">
        <p className="text-sm text-muted-foreground">
          Create a district first so we know where to load voter rows.
        </p>
        <StepActions
          left={
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          }
        />
      </StepCard>
    );
  }

  return (
    <StepCard
      title="Airtable mapping & import"
      description="Connect the voter base, review Claude's proposed field mapping, then run the first import."
    >
      {status.districts.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-navy-50/40 p-3 text-sm">
          <span className="text-muted-foreground">District:</span>
          {status.districts.map((d) => (
            <button
              key={d.id}
              onClick={() => setDistrictId(d.id)}
              className={
                "rounded-md px-2 py-1 text-xs " +
                (d.id === selected.id
                  ? "bg-navy text-white"
                  : "bg-white text-navy-700 hover:bg-navy-100")
              }
            >
              {d.name}
            </button>
          ))}
        </div>
      ) : null}

      <AirtableConnectionWizard
        districtId={selected.id}
        districtName={selected.name}
        initialBaseId={selected.airtable_base_id ?? ""}
        initialTableId={selected.airtable_voters_table_id ?? ""}
        initialMapping={selected.airtable_field_mapping ?? null}
        status={selected.airtable_import_status}
        lastImportedAt={selected.airtable_last_imported_at}
        lastError={selected.airtable_last_error}
        lastSummary={selected.airtable_last_import_summary}
        lastRelative={formatRelative(selected.airtable_last_imported_at)}
      />

      <StepActions
        left={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
        right={
          <Button
            onClick={onDone}
            variant="accent"
            disabled={selected.airtable_import_status !== "ready"}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Users
// ---------------------------------------------------------------------------

function UsersStep({
  status,
  onDone,
  onBack,
}: {
  status: SetupStatus;
  onDone: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"knocker" | "admin">("knocker");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function invite() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        fullName,
        role,
        districtId: status.primaryDistrict?.id ?? null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Invite failed");
      return;
    }
    setNotice(`Invite sent to ${email}.`);
    setEmail("");
    setFullName("");
    router.refresh();
  }

  return (
    <StepCard
      title="Invite your team"
      description="Send invites now — they'll get an email with a sign-in link. You can keep inviting from the Users page later."
    >
      <form
        className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          invite();
        }}
      >
        <Field label="Full name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Pat Canvasser"
          />
        </Field>
        <Field label="Email">
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pat@example.com"
          />
        </Field>
        <Field label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "knocker" | "admin")}
            className="h-10 rounded-md border border-input bg-white px-2 text-sm"
          >
            <option value="knocker">Knocker</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={busy || !email}>
            {busy ? "Sending…" : "Send invite"}
          </Button>
        </div>
        {error ? (
          <div className="md:col-span-4">
            <ErrorBanner>{error}</ErrorBanner>
          </div>
        ) : null}
        {notice ? (
          <p className="md:col-span-4 rounded bg-emerald-100 px-3 py-2 text-xs text-emerald-800">
            {notice}
          </p>
        ) : null}
      </form>

      <p className="text-xs text-muted-foreground">
        Currently {status.teamCount} teammate{status.teamCount === 1 ? "" : "s"} with access to{" "}
        <strong>{status.client?.name ?? "this client"}</strong>.
      </p>

      <StepActions
        left={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
        right={
          <>
            <Button asChild variant="ghost">
              <Link href="/admin/users">
                Manage users <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
            <Button onClick={onDone} variant="accent">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        }
      />
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — Done
// ---------------------------------------------------------------------------

function DoneStep({ status, onBack }: { status: SetupStatus; onBack: () => void }) {
  const incomplete = status.steps.filter((s) => !s.complete);
  return (
    <StepCard
      title={status.allComplete ? "You're live" : "Almost there"}
      description={
        status.allComplete
          ? "Every required piece of setup is configured. Head to the dashboard to start knocking doors."
          : "You can come back to the wizard any time; the remaining items are listed below."
      }
    >
      <div className="flex items-center gap-3">
        <PartyPopper className="h-8 w-8 text-crimson" />
        <div className="text-sm">
          <p className="font-medium text-navy-900">
            {status.allComplete ? "Setup complete." : "Setup partially complete."}
          </p>
          <p className="text-muted-foreground">
            Everything below is also editable on its own settings page at any time.
          </p>
        </div>
      </div>

      {incomplete.length > 0 ? (
        <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Still to do</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {incomplete.map((s) => (
              <li key={s.id}>
                <strong>{s.label}:</strong> {s.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-2 text-sm md:grid-cols-2">
        <SettingLink href="/admin/clients" label="Clients" />
        <SettingLink href="/admin/districts" label="Districts" />
        <SettingLink href="/admin/settings" label="Airtable credentials" />
        <SettingLink href="/admin/airtable" label="Airtable mapping / import" />
        <SettingLink href="/admin/users" label="Users" />
        <SettingLink href="/admin/surveys" label="Surveys" />
      </div>

      <StepActions
        left={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
        right={
          <Button asChild variant="accent">
            <Link href="/admin">Open dashboard</Link>
          </Button>
        }
      />
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational bits
// ---------------------------------------------------------------------------

function StepCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function StepActions({
  left,
  right,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <div className="flex gap-2">{left}</div>
      <div className="flex gap-2">{right}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-navy-700">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 text-xs font-semibold uppercase tracking-widest text-navy-700">
      {children}
    </h3>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm text-navy-900">{value}</span>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-4 w-4 rounded border border-border" style={{ backgroundColor: color }} />
      <span className="font-mono text-xs">{color}</span>
    </span>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{children}</p>
  );
}

function SettingLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-navy-800 hover:bg-navy-50"
    >
      <span>{label}</span>
      <ExternalLink className="h-3 w-3 text-muted-foreground" />
    </Link>
  );
}

function AirtableStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return <Badge variant="success">Ready</Badge>;
    case "importing":
      return <Badge variant="warning">Importing…</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    case "mapping_pending":
      return <Badge variant="warning">Mapping pending</Badge>;
    default:
      return <Badge variant="secondary">Unconfigured</Badge>;
  }
}

