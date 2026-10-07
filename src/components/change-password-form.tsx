"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next.length < 6) return setError("New password must be at least 6 characters.");
    if (next !== confirm) return setError("New passwords don't match.");

    setBusy(true);
    const supabase = createClient();
    // Re-verify the current password so a borrowed unlocked phone can't change it.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (verifyError) {
      setBusy(false);
      return setError("Current password is wrong.");
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  const field = "w-full rounded-md border border-surface-border px-2 py-1.5 text-sm";

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted">Change password</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className={field}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={6}
          className={field}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className={field}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {done && <p className="text-xs text-acacia-green">Password changed.</p>}
    </section>
  );
}
