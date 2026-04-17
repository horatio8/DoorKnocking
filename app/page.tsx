import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-700 to-navy-500 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-3 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-widest">
          Campaign OS
        </span>
        <h1 className="font-serif text-5xl font-semibold tracking-tight sm:text-6xl">
          Door Knock Platform
        </h1>
        <p className="mt-4 max-w-xl text-lg text-navy-50/90">
          District-agnostic field operations for professional campaign teams.
          Knock. Listen. Record. Win.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-md bg-crimson px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-crimson-700"
          >
            Sign in
          </Link>
          <Link
            href="/app"
            className="rounded-md border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/20"
          >
            Open field app
          </Link>
        </div>
        <p className="mt-16 text-xs text-navy-50/60">
          Teller Consulting Group · ABN 93 676 364 855
        </p>
      </div>
    </main>
  );
}
