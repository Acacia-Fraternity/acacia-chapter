// The real Acacia chapter house (702 E 3rd St, Bloomington, IN 47406),
// confirmed via Google Maps — kept here so the presence tracker and the
// House Presence page's display both reference the same source of truth.
// The actual geofence check happens server-side in log_presence_ping()
// (supabase/schema.sql) with the same coordinates — if this ever needs to
// change, update both places.
export const HOUSE_LOCATION = {
  latitude: 39.1639078,
  longitude: -86.5255585,
  radiusMeters: 150,
};
