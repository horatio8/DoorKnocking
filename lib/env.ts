// Centralized env access. Uses STATIC process.env.* references so Next.js can
// inline values at build time — dynamic process.env[name] lookups don't get
// replaced in Edge runtime bundles.

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

// Only-what-the-caller-needs accessors. Keeps pages that just use the anon key
// from crashing on a missing service-role secret, and vice versa.
export function anonEnv() {
  return {
    supabaseUrl: req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: req("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function serviceRoleEnv() {
  return {
    supabaseUrl: req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRoleKey: req("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function airtableEnv() {
  return {
    apiKey: req("AIRTABLE_API_KEY", process.env.AIRTABLE_API_KEY),
  };
}

export function anthropicEnv() {
  return {
    apiKey: req("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY),
  };
}

export function mapboxServerEnv() {
  return {
    secretToken: process.env.MAPBOX_SECRET_TOKEN || undefined,
    publicToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined,
  };
}

// Kept for any older imports; delegates to the narrowed accessors.
export function serverEnv() {
  return {
    ...anonEnv(),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    mapboxSecretToken: process.env.MAPBOX_SECRET_TOKEN || undefined,
    airtableApiKey: process.env.AIRTABLE_API_KEY || "",
    resendApiKey: process.env.RESEND_API_KEY || undefined,
    n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET || undefined,
  };
}
