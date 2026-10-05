"use client";

import { useState, useTransition } from "react";
import { connectCanvas, refreshCanvas, disconnectCanvas } from "@/app/dashboard/grades/actions";

export function CanvasConnect({
  connected,
  lastError,
}: {
  connected: boolean;
  lastError: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (connected) {
    return (
      <div className="space-y-2">
        <div className="flex gap-4 text-sm">
          <button
            disabled={pending}
            onClick={() => run(refreshCanvas)}
            className="underline disabled:opacity-50"
          >
            {pending ? "Working…" : "Refresh grades"}
          </button>
          <button
            disabled={pending}
            onClick={() => run(disconnectCanvas)}
            className="text-red-600 underline disabled:opacity-50"
          >
            Disconnect Canvas
          </button>
        </div>
        {(error || lastError) && <p className="text-xs text-red-600">{error ?? lastError}</p>}
      </div>
    );
  }

  return (
    <form action={(formData) => run(() => connectCanvas(formData))} className="space-y-2">
      <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted">
        <li>In Canvas, open Account → Settings.</li>
        <li>Under Approved Integrations, choose “New Access Token”, name it “Acacia”, and generate it.</li>
        <li>Paste the token here. It is stored privately and only used to read your course grades.</li>
      </ol>
      <input
        name="token"
        type="password"
        required
        autoComplete="off"
        placeholder="Canvas access token"
        className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-acacia-gold text-acacia-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Connecting…" : "Connect Canvas"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
