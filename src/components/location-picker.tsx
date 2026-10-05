"use client";

import { useEffect, useRef, useState } from "react";
import { searchAddresses, type AddressSuggestion } from "@/lib/geocode";
import { HOUSE_LOCATION } from "@/lib/house-location";
import { PLACES } from "@/lib/places";

const DEBOUNCE_MS = 350;

// The default for nearly every event; type in the box to search elsewhere.
const HOUSE_PRESET = {
  label: "702 E 3rd St, Bloomington, IN 47401",
  lat: HOUSE_LOCATION.latitude,
  lng: HOUSE_LOCATION.longitude,
};

export function LocationPicker() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<{ label: string; lat: number; lng: number } | null>(
    HOUSE_PRESET,
  );
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped per request so a slow earlier response can't overwrite a newer one.
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    // Don't re-search the label we just filled in after a pick.
    if (trimmed.length < 3 || trimmed === chosen?.label) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await searchAddresses(trimmed);
      if (id !== requestId.current) return;
      setSuggestions(results);
      setSearching(false);
      setOpen(true);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, chosen]);

  function pick(s: AddressSuggestion) {
    setChosen(s);
    setQuery(s.label);
    setSuggestions([]);
    setOpen(false);
    setError(null);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = {
          label: "Current location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setChosen(here);
        setQuery("");
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location — search for the address instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Location</label>

      <select
        value=""
        onChange={(e) => {
          const place = PLACES.find((p) => p.name === e.target.value);
          if (!place) return;
          const label = `${place.name}, Bloomington, IN`;
          setChosen({ label, lat: place.lat, lng: place.lng });
          setQuery(label);
          setSuggestions([]);
          setError(null);
        }}
        className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm"
      >
        <option value="">Quick pick: SRSC or an IU residence hall…</option>
        {PLACES.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="relative">
        <input
          type="text"
          autoComplete="off"
          placeholder="Search a different address or place…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // Editing the text invalidates the previous pick.
            if (chosen && e.target.value !== chosen.label) setChosen(null);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
        />

        {open && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-surface-border bg-surface shadow-lg">
            {suggestions.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  // mousedown beats the input's blur, which would close the list first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-acacia-gold/20"
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {searching && (
          <p className="mt-1 text-xs text-muted-foreground">Searching…</p>
        )}
        {!searching &&
          open === false &&
          !chosen &&
          query.trim().length >= 3 &&
          suggestions.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              No matches yet — keep typing, or add the city.
            </p>
          )}
      </div>

      <div className="flex gap-4">
        {chosen !== HOUSE_PRESET && (
          <button
            type="button"
            onClick={() => {
              setChosen(HOUSE_PRESET);
              setQuery("");
              setSuggestions([]);
              setError(null);
            }}
            className="text-xs text-muted hover:text-foreground underline"
          >
            Use the Acacia house
          </button>
        )}
        <button
          type="button"
          onClick={useCurrentLocation}
          className="text-xs text-muted hover:text-foreground underline"
        >
          {locating ? "Locating…" : "Use my current location"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {chosen ? (
        <p className="text-xs text-acacia-green">
          ✓ {chosen === HOUSE_PRESET ? `Acacia house — ${chosen.label}` : chosen.label} —
          people can only check in within range of this spot.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pick one of the suggestions so check-in knows where the event is.
        </p>
      )}

      {/* The values the form actually submits. The sr-only required input makes
          the browser block submitting until an address has been picked. */}
      <input type="hidden" name="address" value={chosen?.label === "Current location" ? "" : (chosen?.label ?? "")} />
      <input type="hidden" name="latitude" value={chosen?.lat ?? ""} />
      <input type="hidden" name="longitude" value={chosen?.lng ?? ""} />
      <input
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        required
        readOnly
        value={chosen ? "ok" : ""}
        onChange={() => {}}
      />
    </div>
  );
}
