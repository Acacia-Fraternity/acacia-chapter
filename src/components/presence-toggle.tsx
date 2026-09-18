"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PresenceToggle({ isCurrentlyHome }: { isCurrentlyHome: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "locating" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleImHome() {
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location.");
      return;
    }
    setError(null);
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus("submitting");
        const { error } = await supabase.rpc("log_presence_ping", {
          p_lat: position.coords.latitude,
          p_lng: position.coords.longitude,
        });
        setStatus("idle");
        if (error) {
          setError(error.message);
          return;
        }
        router.refresh();
      },
      () => {
        setStatus("idle");
        setError("Couldn't get your location — allow location access and try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleImLeaving() {
    setError(null);
    setStatus("submitting");
    const { error } = await supabase.rpc("log_presence_leave");
    setStatus("idle");
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex gap-2">
        {!isCurrentlyHome ? (
          <button
            onClick={handleImHome}
            disabled={status !== "idle"}
            className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {status === "locating"
              ? "Finding you…"
              : status === "submitting"
                ? "Checking…"
                : "I'm home"}
          </button>
        ) : (
          <button
            onClick={handleImLeaving}
            disabled={status !== "idle"}
            className="rounded-md border border-surface-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {status === "submitting" ? "Updating…" : "I'm leaving"}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600 max-w-xs">{error}</p>}
    </div>
  );
}
