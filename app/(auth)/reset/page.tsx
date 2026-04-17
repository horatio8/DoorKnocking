"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Reset password</h1>
        {sent ? (
          <p className="mt-4 text-sm text-muted-foreground">
            If an account exists for <strong>{email}</strong>, a reset link is on the way.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Input
              type="email"
              placeholder="you@campaign.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error ? <p className="text-sm text-crimson">{error}</p> : null}
            <Button type="submit" className="w-full">
              Send reset link
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
