"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CheckOutButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCheckOut() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location — can't check out.");
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { error } = await supabase.rpc("check_out", {
          p_event_id: eventId,
          p_lat: position.coords.latitude,
          p_lng: position.coords.longitude,
        });
        setBusy(false);
        if (error) {
          setError(error.message);
          return;
        }
        router.refresh();
      },
      () => {
        setBusy(false);
        setError("Couldn't get your location. Try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      <button
        onClick={handleCheckOut}
        disabled={busy}
        className="rounded-md border border-acacia-gold px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Finding you…" : "Check out"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 max-w-xs">{error}</p>}
    </div>
  );
}
