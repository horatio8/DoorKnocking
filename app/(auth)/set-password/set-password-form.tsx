"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const HOUR_OPTIONS = [4, 8, 12, 20, 40];
const SPEED_OPTIONS: Array<{
  key: "slow" | "medium" | "fast";
  label: string;
  hint: string;
}> = [
  { key: "slow", label: "Slow", hint: "Methodical, longer conversations" },
  { key: "medium", label: "Medium", hint: "Typical canvasser pace" },
  { key: "fast", label: "Fast", hint: "Experienced, brisk" },
];

export function SetPasswordForm() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totalHours, setTotalHours] = useState(8);
  const [speed, setSpeed] = useState<"slow" | "medium" | "fast">("medium");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState<"checking" | "yes" | "no">("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [isKnocker, setIsKnocker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setSessionReady("yes");
        setEmail(data.session.user.email ?? null);
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", data.session.user.id)
          .maybeSingle();
        setIsKnocker((profile as { role?: string } | null)?.role === "knocker");
      } else {
        setTimeout(async () => {
          if (cancelled) return;
          const { data: retry } = await supabase.auth.getSession();
          if (retry.session) {
            setSessionReady("yes");
            setEmail(retry.session.user.email ?? null);
          } else {
            setSessionReady("no");
          }
        }, 400);
      }
    }
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, sess: Session | null) => {
      if (sess) {
        setSessionReady("yes");
        setEmail(sess.user.email ?? null);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { data, error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr || !data.user) {
      setError(updateErr?.message ?? "Couldn't update password.");
      setSubmitting(false);
      return;
    }

    // Clear the must-change-password gate + persist profile fields. Admins
    // get a plain flag-clear; knockers also save their pace/budget answers.
    if (isKnocker) {
      await supabase
        .from("users")
        .update({
          total_time_budget_minutes: totalHours * 60,
          speed_rating: speed,
          must_change_password: false,
          first_login_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);
    } else {
      await supabase
        .from("users")
        .update({
          must_change_password: false,
          first_login_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (role === "admin" || role === "super_admin") {
      router.replace("/admin");
    } else {
      router.replace("/app");
    }
    router.refresh();
  }

  if (sessionReady === "checking") {
    return <p className="text-sm text-muted-foreground">Verifying invite…</p>;
  }

  if (sessionReady === "no") {
    return (
      <div className="space-y-3">
        <p className="rounded bg-crimson/10 px-3 py-2 text-sm text-crimson">
          Invite link expired or already used. Ask your admin to resend.
        </p>
        <Button variant="outline" onClick={() => router.replace("/login")} className="w-full">
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {email ? (
        <p className="text-xs text-muted-foreground">
          Setting up <strong>{email}</strong>
        </p>
      ) : null}

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">Password</p>
        <div className="space-y-1">
          <label htmlFor="pw" className="text-sm font-medium text-navy-900">
            New password
          </label>
          <Input
            id="pw"
            type="password"
            value={password}
            autoComplete="new-password"
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="pw2" className="text-sm font-medium text-navy-900">
            Confirm password
          </label>
          <Input
            id="pw2"
            type="password"
            value={confirm}
            autoComplete="new-password"
            minLength={8}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
      </div>

      {isKnocker ? (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">
              Total hours you can canvass
            </p>
            <p className="text-xs text-muted-foreground">
              Across the whole campaign. Your admin uses this to balance assignments.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {HOUR_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setTotalHours(h)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    totalHours === h
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-navy-200 bg-white text-navy-700"
                  }`}
                >
                  {h}h
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={200}
                value={totalHours}
                onChange={(e) => setTotalHours(Number(e.target.value))}
                className="w-16 rounded-full border border-navy-200 px-2 py-1 text-center text-xs"
                aria-label="Custom hours"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">
              Pace
            </p>
            <p className="text-xs text-muted-foreground">
              Be honest — we calibrate walkbook time estimates to your pace.
            </p>
            <div className="space-y-1.5">
              {SPEED_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${
                    speed === opt.key
                      ? "border-navy-900 bg-navy-50"
                      : "border-navy-200 bg-white hover:border-navy-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="speed"
                    value={opt.key}
                    checked={speed === opt.key}
                    onChange={() => setSpeed(opt.key)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-navy-900">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {error ? <p className="text-sm text-crimson">{error}</p> : null}
      <Button type="submit" disabled={submitting} className="w-full" size="lg">
        {submitting ? "Saving…" : "Save & continue"}
      </Button>
    </form>
  );
}
