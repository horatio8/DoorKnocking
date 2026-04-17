import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// /api/diag — runs a handful of server-side checks and returns JSON.
// Public, but only exposes presence/connectivity info, not values.
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
      has_AIRTABLE_API_KEY: Boolean(process.env.AIRTABLE_API_KEY),
      node_version: process.version,
    },
    checks: [] as Array<{ name: string; ok: boolean; detail?: string }>,
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const checks = report.checks as Array<{ name: string; ok: boolean; detail?: string }>;

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

  return NextResponse.json(report, { status: 200 });
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
