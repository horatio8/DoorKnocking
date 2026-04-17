import { NextResponse, type NextRequest } from "next/server";

// Hosts where we know no client scoping should be applied (admin console and
// local dev). Everything else: try to derive a client slug from the host.
const APEX_HOSTS = new Set([
  "campaignos.com",
  "www.campaignos.com",
  "localhost:3000",
  "localhost",
]);
const SUPER_ADMIN_SUBDOMAINS = new Set(["app", "admin"]);

// Extracts the left-most subdomain label and returns it if it looks like a
// client slug. Returns null for apex, www, app, or unrecognized shapes.
function resolveClientSlug(host: string | null): string | null {
  if (!host) return null;
  const lower = host.toLowerCase().split(":")[0]; // drop port
  if (APEX_HOSTS.has(host.toLowerCase())) return null;

  // Vercel preview URLs like door-knocking-...-vercel.app — skip scoping so
  // the current deployment remains usable without DNS.
  if (lower.endsWith(".vercel.app")) return null;

  const parts = lower.split(".");
  if (parts.length < 3) return null;
  const first = parts[0];
  if (SUPER_ADMIN_SUBDOMAINS.has(first)) return null;
  if (!/^[a-z0-9-]+$/.test(first)) return null;
  return first;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Path-based fallback: /c/<slug>/... → treat as if <slug>.campaignos.com
  const pathSlugMatch = pathname.match(/^\/c\/([a-z0-9-]+)(\/.*)?$/);
  let slug: string | null = null;
  let rewritten: URL | null = null;

  if (pathSlugMatch) {
    slug = pathSlugMatch[1];
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = pathSlugMatch[2] || "/";
    rewritten = newUrl;
  } else {
    slug = resolveClientSlug(request.headers.get("host"));
  }

  const requestHeaders = new Headers(request.headers);
  if (slug) requestHeaders.set("x-client-slug", slug);
  else requestHeaders.delete("x-client-slug");

  if (rewritten) {
    return NextResponse.rewrite(rewritten, {
      request: { headers: requestHeaders },
    });
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Skip static assets, SW, icons, and manifest — nothing there needs client scope.
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.png$).*)",
  ],
};
