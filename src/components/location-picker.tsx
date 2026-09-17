"use client";

import { useState } from "react";

export function LocationPicker() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("idle");
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium">Location</label>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="text-xs text-muted hover:text-foreground underline"
        >
          {status === "locating" ? "Locating…" : "Use my current location"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-red-600">Couldn&apos;t get your location — enter it manually.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          name="latitude"
          type="number"
          step="any"
          required
          placeholder="Latitude"
          value={coords?.lat ?? ""}
          onChange={(e) =>
            setCoords((c) => ({ lat: Number(e.target.value), lng: c?.lng ?? 0 }))
          }
          className="rounded-md border border-surface-border px-3 py-2 text-sm"
        />
        <input
          name="longitude"
          type="number"
          step="any"
          required
          placeholder="Longitude"
          value={coords?.lng ?? ""}
          onChange={(e) =>
            setCoords((c) => ({ lat: c?.lat ?? 0, lng: Number(e.target.value) }))
          }
          className="rounded-md border border-surface-border px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
