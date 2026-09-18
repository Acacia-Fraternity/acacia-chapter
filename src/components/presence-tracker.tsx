"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const PING_INTERVAL_MS = 3 * 60 * 1000;

/**
 * Invisible, mounted once for every signed-in page (see dashboard/layout.tsx).
 * Pings the server with the current GPS position every few minutes while
 * the app is actually open and visible — see the big comment on
 * house_presence_sessions in supabase/schema.sql for why "while open" is
 * the ceiling of what's possible here (no background location on phones).
 * Deliberately renders nothing and never surfaces errors to the user —
 * a missed ping just means that stretch of time doesn't count, not a
 * broken app.
 */
export function PresenceTracker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const supabase = createClient();
    let cancelled = false;

    function ping() {
      if (document.visibilityState !== "visible") return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return;
          supabase.rpc("log_presence_ping", {
            p_lat: position.coords.latitude,
            p_lng: position.coords.longitude,
          });
        },
        () => {
          // Permission denied or unavailable — nothing to do, just skip
          // this tick silently.
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    }

    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    document.addEventListener("visibilitychange", ping);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return null;
}
