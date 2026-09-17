"use client";

import { useState } from "react";
import { geocodeAddress } from "@/lib/geocode";

export function LocationPicker() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "locating" | "geocoding" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      setError("Your browser doesn't support location.");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setResolvedAddress(null);
        setStatus("idle");
      },
      () => {
        setStatus("error");
        setError("Couldn't get your location — enter it manually or look up an address.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function lookupAddress() {
    if (!address.trim()) return;
    setStatus("geocoding");
    setError(null);
    const result = await geocodeAddress(address);
    if (!result) {
      setStatus("error");
      setError("Couldn't find that address — try being more specific, or enter coordinates manually.");
      return;
    }
    setCoords({ lat: result.lat, lng: result.lng });
    setResolvedAddress(result.displayName);
    setStatus("idle");
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Location</label>

      <div className="flex gap-2">
        <input
          name="address"
          placeholder="Type an address (e.g. 702 E 3rd St, Bloomington, IN)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="flex-1 rounded-md border border-surface-border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={lookupAddress}
          disabled={status === "geocoding" || !address.trim()}
          className="rounded-md border border-surface-border px-3 py-2 text-sm disabled:opacity-50"
        >
          {status === "geocoding" ? "Looking up…" : "Look up"}
        </button>
      </div>

      <button
        type="button"
        onClick={useCurrentLocation}
        className="text-xs text-muted hover:text-foreground underline"
      >
        {status === "locating" ? "Locating…" : "Or use my current location"}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {resolvedAddress && (
        <p className="text-xs text-acacia-green">Found: {resolvedAddress}</p>
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
