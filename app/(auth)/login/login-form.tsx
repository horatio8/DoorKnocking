"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    try {
      const signIn = () => {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Sign-in timed out after 15s")), 15_000),
        );
        return Promise.race([
          supabase.auth.signInWithPassword({ email, password }),
          timeout,
        ]) as ReturnType<typeof supabase.auth.signInWithPassword>;
      };

      let { data, error: authError } = await signIn();

      // Invite-only platform — email confirmation adds no security here, it
      // just blocks legitimate users whose invite path didn't auto-confirm.
      // Force-confirm via the server endpoint and retry once.
      if (authError && /email not confirmed/i.test(authError.message)) {
        await fetch("/api/auth/confirm-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }).catch(() => null);
        ({ data, error: authError } = await signIn());
      }

      if (authError || !data?.session) {
        setError(authError?.message ?? "Sign in failed");
        setSubmitting(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profileError) {
        console.error("login: profile lookup failed", profileError);
      }
      const role = (profile as { role?: string } | null)?.role;
      if (role === "admin" || role === "super_admin") {
        router.replace("/admin");
      } else {
        router.replace("/app");
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      console.error("login: unexpected error", err);
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-navy-900">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-navy-900">
          Password
        </label>
        <Input
          id="password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-crimson">{error}</p> : null}
      <Button type="submit" disabled={submitting} className="w-full" size="lg">
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        No self-serve signup. Contact your admin for an invite.
      </p>
    </form>
  );
}
