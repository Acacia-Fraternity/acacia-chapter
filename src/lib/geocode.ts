"use server";

/**
 * Free geocoding via OpenStreetMap's Nominatim — no API key, but their usage
 * policy requires a real User-Agent and caps requests at ~1/sec, which is
 * far more than this app (a handful of admins creating events) will ever
 * need. Server-side only: Nominatim doesn't send CORS headers, so a direct
 * browser fetch would fail anyway.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Acacia-Chapter-App/1.0 (chapter attendance tracker)",
    },
  });

  if (!response.ok) return null;

  const results = (await response.json()) as {
    lat: string;
    lon: string;
    display_name: string;
  }[];

  const first = results[0];
  if (!first) return null;

  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
    displayName: first.display_name,
  };
}
