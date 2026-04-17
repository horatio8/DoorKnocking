// Centralized env access. Uses STATIC process.env.* references so Next.js can
// inline values at build time — dynamic process.env[name] lookups don't get
// replaced in Edge runtime bundles, which kills the middleware.

function req(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: req("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  mapboxToken: req("NEXT_PUBLIC_MAPBOX_TOKEN", process.env.NEXT_PUBLIC_MAPBOX_TOKEN),
};

export function serverEnv() {
  return {
    supabaseUrl: req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: req("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: req("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    mapboxSecretToken: process.env.MAPBOX_SECRET_TOKEN || undefined,
    airtableApiKey: req("AIRTABLE_API_KEY", process.env.AIRTABLE_API_KEY),
    resendApiKey: process.env.RESEND_API_KEY || undefined,
    n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET || undefined,
  };
}
