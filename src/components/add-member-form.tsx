"use client";

import { useRef, useState, useTransition } from "react";
import { createMember } from "@/app/dashboard/admin/actions";

function randomPassword() {
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-6);
}

export function AddMemberForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<{ email: string; password: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email"));
    const pw = String(formData.get("password"));

    startTransition(async () => {
      try {
        await createMember(formData);
        setJustAdded({ email, password: pw });
        formRef.current?.reset();
        setPassword("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add member");
      }
    });
  }

  return (
    <div className="rounded-lg border border-surface-border p-3 space-y-3">
      <form ref={formRef} action={handleSubmit} className="grid gap-2 sm:grid-cols-4">
        <input
          name="full_name"
          placeholder="Full name"
          required
          className="rounded-md border border-surface-border px-2 py-1.5 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-md border border-surface-border px-2 py-1.5 text-sm"
        />
        <div className="flex gap-1">
          <input
            name="password"
            placeholder="Password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 rounded-md border border-surface-border px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => setPassword(randomPassword())}
            className="rounded-md border border-surface-border px-2 py-1.5 text-xs shrink-0"
            title="Generate a random password"
          >
            Gen
          </button>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add member"}
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {justAdded && (
        <p className="text-xs text-acacia-green">
          Added <strong>{justAdded.email}</strong> — share this password with them
          directly (it won&apos;t be shown again): <code>{justAdded.password}</code>
        </p>
      )}
    </div>
  );
}
