import type { TrackerStatus } from "./types";

// Must match the interval in note_tracker_ping() (supabase/schema.sql): a gap
// longer than this between pings is recorded as an outage, and a tracker that
// has been silent this long is shown as down.
export const TRACKER_QUIET_MINUTES = 20;

export type TrackerState = "working" | "rejected" | "down" | "never";

export function trackerState(status: TrackerStatus | undefined, nowMs: number): TrackerState {
  if (!status) return "never";
  const quietMs = nowMs - new Date(status.last_ping_at).getTime();
  if (quietMs > TRACKER_QUIET_MINUTES * 60_000) return "down";
  // Pinging, but the server is throwing every fix away (bad GPS, stale fixes).
  if (status.last_issue) return "rejected";
  return "working";
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr${hours === 1 ? "" : "s"} ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} days`;
}
