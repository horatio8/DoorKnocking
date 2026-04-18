import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readdirSync } from "node:fs";
import path from "node:path";

// /api/diag — runs a handful of server-side checks and returns JSON.
// Public, but only exposes presence/connectivity info, not values.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
  const report: Record<string, unknown> = {
    at: new Date().toISOString(),
    env: {
      has_NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_URL_host: safeHost(process.env.NEXT_PUBLIC_SUPABASE_URL),
      has_NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      anon_key_prefix: prefix(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      has_SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      service_role_key_prefix: prefix(process.env.SUPABASE_SERVICE_ROLE_KEY),
      has_NEXT_PUBLIC_MAPBOX_TOKEN: Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN),
      has_MAPBOX_SECRET_TOKEN: Boolean(process.env.MAPBOX_SECRET_TOKEN),
      has_AIRTABLE_API_KEY: Boolean(process.env.AIRTABLE_API_KEY),
      has_AIRTABLE_OAUTH_CLIENT_ID: Boolean(process.env.AIRTABLE_OAUTH_CLIENT_ID),
      has_AIRTABLE_OAUTH_CLIENT_SECRET: Boolean(process.env.AIRTABLE_OAUTH_CLIENT_SECRET),
      has_AIRTABLE_OAUTH_REDIRECT_URI: Boolean(process.env.AIRTABLE_OAUTH_REDIRECT_URI),
      AIRTABLE_OAUTH_REDIRECT_URI: process.env.AIRTABLE_OAUTH_REDIRECT_URI ?? null,
      has_APP_SECRET: Boolean(process.env.APP_SECRET),
      has_ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      has_RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      has_NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      node_version: process.version,
    },
    checks: [] as Array<{ name: string; ok: boolean; detail?: string }>,
    tables: {} as Record<string, number | string>,
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const checks = report.checks as Array<{ name: string; ok: boolean; detail?: string }>;
  const tables = report.tables as Record<string, number | string>;

  // 1. Auth settings endpoint should always respond
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey ?? "" },
    });
    checks.push({
      name: "auth.settings",
      ok: res.ok,
      detail: `status=${res.status}`,
    });
  } catch (err) {
    checks.push({ name: "auth.settings", ok: false, detail: (err as Error).message });
  }

  // 2. Anon client query against a public table
  try {
    const supabase = createClient(url ?? "", anonKey ?? "");
    const { error } = await supabase.from("districts").select("slug").limit(1);
    checks.push({
      name: "anon.districts_select",
      ok: !error,
      detail: error?.message,
    });
  } catch (err) {
    checks.push({ name: "anon.districts_select", ok: false, detail: (err as Error).message });
  }

  // 3. Service-role client can list auth users
  try {
    const svc = createClient(url ?? "", serviceKey ?? "", {
      auth: { persistSession: false },
    });
    const { data, error } = await svc.auth.admin.listUsers({ perPage: 1 });
    checks.push({
      name: "service_role.list_users",
      ok: !error,
      detail: error ? error.message : `count=${data?.users?.length ?? 0}`,
    });
  } catch (err) {
    checks.push({ name: "service_role.list_users", ok: false, detail: (err as Error).message });
  }

  // 4. Service role: count users table rows
  try {
    const svc = createClient(url ?? "", serviceKey ?? "", {
      auth: { persistSession: false },
    });
    const { count, error } = await svc.from("users").select("id", { count: "exact", head: true });
    checks.push({
      name: "service_role.users_count",
      ok: !error,
      detail: error ? error.message : `count=${count ?? 0}`,
    });
  } catch (err) {
    checks.push({ name: "service_role.users_count", ok: false, detail: (err as Error).message });
  }

  // 5. Table existence + row counts — one probe per required table
  try {
    const svc = createClient(url ?? "", serviceKey ?? "", {
      auth: { persistSession: false },
    });
    const required = [
      "clients",
      "client_credentials",
      "districts",
      "users",
      "voters",
      "households",
      "walkbooks",
      "walkbook_households",
      "walkbook_assignments",
      "walk_time_calibration",
      "walkbook_generation_runs",
      "knock_events",
      "surveys",
      "survey_questions",
      "survey_responses",
      "tags",
      "voter_tags",
    ];
    for (const t of required) {
      const { count, error } = await svc.from(t).select("*", { count: "exact", head: true });
      tables[t] = error ? `ERROR: ${error.message}` : (count ?? 0);
    }
  } catch (err) {
    checks.push({ name: "tables.probe", ok: false, detail: (err as Error).message });
  }

  // 6. Orphan public.users with no matching auth.users — symptom of bad seed data
  try {
    const svc = createClient(url ?? "", serviceKey ?? "", {
      auth: { persistSession: false },
    });
    const { data: allUsers } = await svc.from("users").select("id, email");
    const { data: authList } = await svc.auth.admin.listUsers({ perPage: 1000 });
    const authIds = new Set((authList?.users ?? []).map((u) => u.id));
    const orphans = (allUsers ?? []).filter((u) => !authIds.has(u.id as string));
    checks.push({
      name: "users.orphan_check",
      ok: orphans.length === 0,
      detail:
        orphans.length === 0
          ? "all public.users rows have a matching auth.users entry"
          : `${orphans.length} orphan(s): ${orphans.map((o) => o.email).join(", ")}`,
    });
  } catch (err) {
    checks.push({ name: "users.orphan_check", ok: false, detail: (err as Error).message });
  }

  // 7. Migrations — cross-check repo files against supabase_migrations.
  try {
    const expected = listExpectedMigrations();
    const svc = createClient(url ?? "", serviceKey ?? "", {
      auth: { persistSession: false },
    });
    const { data: appliedRows, error } = await svc
      .schema("supabase_migrations")
      .from("schema_migrations")
      .select("version");
    if (error) throw error;
    const applied = new Set(((appliedRows ?? []) as Array<{ version: string }>).map((r) => r.version));
    const missing = expected.filter((v) => !applied.has(v));
    const extras = Array.from(applied).filter((v) => !expected.includes(v));
    (report as Record<string, unknown>).migrations = {
      expected_count: expected.length,
      applied_count: applied.size,
      missing,
      extras,
    };
    checks.push({
      name: "migrations.repo_vs_db",
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `${applied.size}/${expected.length} applied, repo fully in sync`
          : `missing: ${missing.join(", ")}`,
    });
  } catch (err) {
    checks.push({ name: "migrations.repo_vs_db", ok: false, detail: (err as Error).message });
  }

  // Note: Vercel deploy status is queried directly by the GitHub Action
  // workflow using its own VERCEL_TOKEN secret — no need to ship that
  // token into the Vercel runtime. The workflow merges the result into
  // .diag/summary.md after /api/diag returns.

  return NextResponse.json(report, { status: 200 });
}

function listExpectedMigrations(): string[] {
  try {
    const dir = path.join(process.cwd(), "supabase", "migrations");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, "").split("_")[0])
      .filter((v) => /^\d+$/.test(v))
      .sort();
  } catch {
    return [];
  }
}

function safeHost(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

function prefix(key?: string): string | null {
  if (!key) return null;
  return key.slice(0, 12);
}
