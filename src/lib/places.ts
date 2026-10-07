// Campus spots the chapter cares about, offered as one-tap presets in the
// event location picker and drawn on the House Presence map. Coordinates were
// geocoded from OpenStreetMap (Photon), not typed from memory.
// Not yet listed: Wells Quad and Collins LLC — the geocoder couldn't place them.
import { HOUSE_LOCATION } from "@/lib/house-location";

export type PlaceKind = "recreation" | "residence";

export interface Place {
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
}

// Same vicinity as the chapter house's geofence, so "at a hall" means the same
// thing as "at the house".
export const PLACE_RADIUS_METERS = 150;

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Name of the nearest place (house included) whose vicinity contains the point. */
export function placeAt(lat: number, lng: number): string | null {
  let best: { name: string; d: number } | null = null;
  const candidates = [
    { name: "the house", lat: HOUSE_LOCATION.latitude, lng: HOUSE_LOCATION.longitude },
    ...PLACES,
  ];
  for (const c of candidates) {
    const d = distanceMeters(lat, lng, c.lat, c.lng);
    if (d <= PLACE_RADIUS_METERS && (!best || d < best.d)) best = { name: c.name, d };
  }
  return best?.name ?? null;
}

export const PLACES: Place[] = [
  { name: "SRSC (Student Recreational Sports Center)", kind: "recreation", lat: 39.17343, lng: -86.5124 },
  { name: "Ashton Center", kind: "residence", lat: 39.17081, lng: -86.51146 },
  { name: "Briscoe Quad", kind: "residence", lat: 39.17827, lng: -86.52006 },
  { name: "Eigenmann Hall", kind: "residence", lat: 39.17099, lng: -86.50874 },
  { name: "Forest Quad", kind: "residence", lat: 39.16436, lng: -86.51282 },
  { name: "Foster Quad", kind: "residence", lat: 39.17557, lng: -86.51889 },
  { name: "McNutt Quad", kind: "residence", lat: 39.17646, lng: -86.51993 },
  { name: "Read Hall", kind: "residence", lat: 39.16614, lng: -86.51489 },
  { name: "Teter Quad", kind: "residence", lat: 39.17047, lng: -86.51339 },
  { name: "Tulip Tree Apartments", kind: "residence", lat: 39.1725, lng: -86.50445 },
  { name: "Union Street Center", kind: "residence", lat: 39.17074, lng: -86.50954 },
  { name: "Willkie Quad", kind: "residence", lat: 39.16616, lng: -86.51102 },
  { name: "Wright Quad", kind: "residence", lat: 39.17041, lng: -86.51429 },
];
