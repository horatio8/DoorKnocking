"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { Eyebrow } from "./eyebrow";
import { CivicButton } from "./civic-button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackFunnel } from "@/lib/marketing/funnel";

// 03 · Verify email parking screen. See signup.jsx CheckEmailPage. Includes
// an inline preview of the verification email we'll send.

export function VerifyView({ email }: { email: string }) {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // When Supabase redirects back after the magic link, the helper lands us
  // here with a session in hand. Fire the funnel event, stamp
  // email_verified_at, then push into the wizard.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return false;
      trackFunnel("email_verified");
      await fetch("/api/onboarding/verified", { method: "POST" }).catch(() => {});
      router.replace("/setup/role");
      return true;
    };
    void run();
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_evt: string, session: Session | null) => {
        if (session) void run();
      },
    );
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function resend() {
    setResending(true);
    setNotice(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setNotice("Sent — check your inbox.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setResending(false);
    }
  }

  function simulate() {
    // Prototype hook kept for internal demos — skips the real magic-link.
    router.push("/setup/role");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-8 py-20">
      <div className="w-full max-w-[480px] text-center">
        {/* Seal — concentric circles with mail icon inside */}
        <div className="relative mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-full border-[1.5px] border-civic-navy">
          <MailIcon className="h-7 w-7 text-civic-navy" />
          <div className="pointer-events-none absolute inset-[5px] rounded-full border border-civic-navy" />
        </div>

        <Eyebrow variant="oxblood" className="mb-2.5 block">
          Step 2 of 4 — Verify
        </Eyebrow>
        <h1 className="mb-3 font-serif text-[32px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
          Check your email.
        </h1>
        <p className="mx-auto mb-8 max-w-[400px] text-[15.5px] text-ink-2">
          We sent a verification link to{" "}
          <strong className="font-mono text-sm text-civic-navy">{email}</strong>. Click it to
          continue.
        </p>

        {/* Inline email preview */}
        <div className="mb-6 border border-rule bg-parchment p-5 text-left">
          <Eyebrow className="mb-2.5 block">Preview of email you&rsquo;ll receive</Eyebrow>
          <div className="border border-rule-2 bg-white p-4">
            <p className="mb-1 text-xs text-mute">
              From: Campaign OS &lt;no-reply@campaignos.com&gt;
            </p>
            <p className="mb-2.5 text-[13px] font-semibold text-ink">
              Verify your email to start canvassing
            </p>
            <p className="mb-3.5 text-xs text-ink-2">
              Hi — tap the button below to verify this email and activate your Campaign OS
              account.
            </p>
            <CivicButton
              type="button"
              variant="primary"
              size="sm"
              className="pointer-events-none"
              tabIndex={-1}
            >
              Verify email →
            </CivicButton>
          </div>
        </div>

        <div className="flex justify-center gap-5 text-sm">
          <button
            type="button"
            onClick={simulate}
            className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood"
          >
            → Simulate verification (prototype)
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood disabled:opacity-60"
          >
            {resending ? "Resending…" : "Resend email"}
          </button>
        </div>
        {notice ? (
          <p className="mt-3 text-xs text-mute">{notice}</p>
        ) : null}
        <p className="mt-10 text-xs text-mute">
          Didn&rsquo;t receive? Check spam, or{" "}
          <Link href="#" className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood">
            contact support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...props}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="0.5" />
      <path d="M1.5 4.5l6.5 4.5 6.5-4.5" />
    </svg>
  );
}
