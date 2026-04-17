import { cache } from "react";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface ClientBrand {
  primary_color?: string;
  accent_color?: string;
  logo_url?: string;
  short_name?: string;
}

export interface ActiveClient {
  id: string;
  slug: string;
  name: string;
  brand: ClientBrand;
  contact_email: string | null;
  active: boolean;
}

// Resolves the client scoped by the current subdomain / path prefix. Returns
// null if no client is in context (apex, super-admin console, or unknown
// slug). React cache() memoises per-request so we only query once per render.
export const getActiveClient = cache(async (): Promise<ActiveClient | null> => {
  const slug = headers().get("x-client-slug");
  if (!slug) return null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, slug, name, brand, contact_email, active")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getActiveClient: lookup failed", error);
    return null;
  }
  if (!data || !data.active) return null;

  return data as ActiveClient;
});

export function clientBrandCss(brand: ClientBrand | null | undefined): string {
  if (!brand) return "";
  const decls: string[] = [];
  if (brand.primary_color) decls.push(`--client-primary:${brand.primary_color};`);
  if (brand.accent_color) decls.push(`--client-accent:${brand.accent_color};`);
  return decls.join("");
}
