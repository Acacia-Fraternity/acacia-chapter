"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CheckInButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "locating" | "submitting" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  function handleCheckIn() {
    setError(null);

    if (!navigator.geolocation) {
      setError("Your browser doesn't support location — can't check in.");
      setStatus("error");
      return;
    }

    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus("submitting");
        const { error } = await supabase.rpc("check_in", {
          p_event_id: eventId,
          p_lat: position.coords.latitude,
          p_lng: position.coords.longitude,
        });

        if (error) {
          setError(error.message);
          setStatus("error");
          return;
        }

        setStatus("idle");
        router.refresh();
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission denied — allow location access to check in."
            : "Couldn't get your location. Try again.",
        );
        setStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      <button
        onClick={handleCheckIn}
        disabled={status === "locating" || status === "submitting"}
        className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
      >
        {status === "locating"
          ? "Finding you…"
          : status === "submitting"
            ? "Checking in…"
            : "Check in"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 max-w-xs">{error}</p>}
    </div>
  );
}
