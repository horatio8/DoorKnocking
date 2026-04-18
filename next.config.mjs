/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Include the migrations directory in the serverless bundle so /api/diag
    // can enumerate what the repo expects vs. what the DB has applied.
    // (Top-level in Next 15; still nested under experimental on 14.x.)
    outputFileTracingIncludes: {
      "/api/diag": ["./supabase/migrations/**/*.sql"],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api.mapbox.com https://events.mapbox.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com; img-src 'self' data: blob: https://*.mapbox.com https://api.mapbox.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com; font-src 'self' https://fonts.gstatic.com data:; manifest-src 'self';",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
