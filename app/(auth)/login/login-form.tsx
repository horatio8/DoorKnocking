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
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError || !data.session) {
      setError(authError?.message ?? "Sign in failed");
      setSubmitting(false);
      return;
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.session.user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (role === "admin" || role === "super_admin") {
      router.replace("/admin");
    } else {
      router.replace("/app");
    }
    router.refresh();
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
