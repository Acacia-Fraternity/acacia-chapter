"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AcaciaMark } from "@/components/acacia-mark";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <AcaciaMark size={72} />
          </div>
          <h1 className="text-2xl font-bold">Reset password</h1>
          <p className="text-sm text-muted">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {status === "sent" ? (
          <p className="text-sm text-acacia-green text-center">
            If that email has an account, a reset link is on its way — check your
            inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-md bg-acacia-gold text-acacia-black py-2 text-sm font-semibold disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <a
          href="/login"
          className="block text-center text-sm text-muted hover:text-foreground"
        >
          Back to sign in
        </a>
      </div>
    </main>
  );
}
