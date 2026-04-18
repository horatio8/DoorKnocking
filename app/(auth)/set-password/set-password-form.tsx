"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SetPasswordForm() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState<"checking" | "yes" | "no">("checking");
  const [email, setEmail] = useState<string | null>(null);

  // Supabase's SSR client auto-processes access_token from the URL hash on
  // load. We just wait for the session to be visible, then ask for a password.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setSessionReady("yes");
        setEmail(data.session.user.email ?? null);
      } else {
        // Give the hash processor a beat, then retry.
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
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
    <form onSubmit={onSubmit} className="space-y-4">
      {email ? (
        <p className="text-xs text-muted-foreground">
          Setting password for <strong>{email}</strong>
        </p>
      ) : null}
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
      {error ? <p className="text-sm text-crimson">{error}</p> : null}
      <Button type="submit" disabled={submitting} className="w-full" size="lg">
        {submitting ? "Saving…" : "Save password & continue"}
      </Button>
    </form>
  );
}
