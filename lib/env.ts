// Centralized env access so we fail loudly on missing required keys.
function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const publicEnv = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  mapboxToken: required("NEXT_PUBLIC_MAPBOX_TOKEN"),
};

export function serverEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    mapboxSecretToken: optional("MAPBOX_SECRET_TOKEN"),
    airtableApiKey: required("AIRTABLE_API_KEY"),
    resendApiKey: optional("RESEND_API_KEY"),
    n8nWebhookSecret: optional("N8N_WEBHOOK_SECRET"),
  };
}
