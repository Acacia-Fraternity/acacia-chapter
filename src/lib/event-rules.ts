import type { Event } from "@/lib/types";

// "Pledge Duration" is the long countdown bar for the whole pledge class, not
// something you attend, so it never has RSVP or check-in. Keep in sync with
// the same rule in check_in() in schema.sql.
export function isPledgeDuration(event: Pick<Event, "name">): boolean {
  return /pledge duration/i.test(event.name);
}

// Check-in (and the RSVP that goes with it) only exists for events that
// were set up with "RSVP? Yes".
export function hasRsvp(event: Pick<Event, "name" | "rsvp_required">): boolean {
  return event.rsvp_required && !isPledgeDuration(event);
}
