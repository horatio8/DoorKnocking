import { cache } from "react";
import { cookies, headers } from "next/headers";
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

// Resolves the client scoped by (in order): the subdomain / path prefix, then
// an explicit active_client_id cookie the admin picked via ClientSwitcher.
// Returns null if nothing matches. React cache() memoises per-request so we
// only query once per render.
//
// The cookie lookup still goes through RLS on the clients table
// (has_client_access or is_super_admin), so a stolen cookie can't elevate
// privilege — worst case, the lookup returns no rows and we fall through.
export const getActiveClient = cache(async (): Promise<ActiveClient | null> => {
  const supabase = getSupabaseServerClient();

  const slug = headers().get("x-client-slug");
  if (slug) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, slug, name, brand, contact_email, active")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.error("getActiveClient: slug lookup failed", error);
    } else if (data && (data as ActiveClient).active) {
      return data as ActiveClient;
    }
  }

  const cookieValue = cookies().get("active_client_id")?.value;
  if (cookieValue) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, slug, name, brand, contact_email, active")
      .eq("id", cookieValue)
      .maybeSingle();
    if (error) {
      console.error("getActiveClient: cookie lookup failed", error);
    } else if (data && (data as ActiveClient).active) {
      return data as ActiveClient;
    }
  }

  return null;
});

export function clientBrandCss(brand: ClientBrand | null | undefined): string {
  if (!brand) return "";
  const decls: string[] = [];
  if (brand.primary_color) decls.push(`--client-primary:${brand.primary_color};`);
  if (brand.accent_color) decls.push(`--client-accent:${brand.accent_color};`);
  return decls.join("");
}
