"use server";

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

// Bloomington — results near here rank first, but anywhere in the world is
// still returned (a philanthropy event might be in Indianapolis, a formal in
// Toronto).
const BIAS = { lat: 39.1653, lng: -86.5264 };

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

/**
 * Address/place type-ahead via Photon (komoot's OpenStreetMap geocoder) — free,
 * no API key, and built for search-as-you-type, which Nominatim's usage policy
 * explicitly forbids. Server-side so the browser never calls a third party
 * directly. Callers must debounce.
 */
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url =
    `https://photon.komoot.io/api/?limit=6&lat=${BIAS.lat}&lon=${BIAS.lng}` +
    `&q=${encodeURIComponent(q)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "Acacia-Chapter-App/1.0 (chapter attendance tracker)" },
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];

  const data = (await response.json()) as { features?: PhotonFeature[] };

  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];
  for (const feature of data.features ?? []) {
    const p = feature.properties;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    // Skip the name when it's just the street repeated.
    const name = p.name && p.name !== p.street ? p.name : "";
    const label = [name, street, p.city, p.state, p.postcode, p.country]
      .filter(Boolean)
      .join(", ");
    if (!label || seen.has(label)) continue;
    seen.add(label);
    suggestions.push({
      label,
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
    });
  }
  return suggestions;
}
