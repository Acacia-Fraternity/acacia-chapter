"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AcaciaMark } from "@/components/acacia-mark";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkState, setLinkState] = useState<"checking" | "ready" | "invalid">("checking");

  // The reset link only works in the browser that requested it (PKCE), and its
  // code is single-use. Surface the real exchange error instead of letting
  // updateUser fail later with a bare "Auth session missing!".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (!cancelled) setLinkState("ready");
        return;
      }
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !exchangeError) return setLinkState("ready");
        if (!cancelled && exchangeError) setError(exchangeError.message);
      }
      if (!cancelled) setLinkState("invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <AcaciaMark size={72} />
          </div>
          <h1 className="text-2xl font-bold">Set a new password</h1>
        </div>

        {linkState === "invalid" && (
          <div className="space-y-3 text-center text-sm">
            <p className="text-red-600">
              This reset link is invalid or already used{error ? ` (${error})` : ""}. Links
              are single-use and only work in the browser you requested them from.
            </p>
            <Link href="/forgot-password" className="underline">
              Request a new link
            </Link>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={linkState === "ready" ? "space-y-4" : "hidden"}
        >
          <div>
            <label className="block text-sm font-medium mb-1">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-acacia-gold text-acacia-black py-2 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save new password"}
          </button>
        </form>
      </div>
    </main>
  );
}
