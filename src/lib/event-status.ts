import type { Event } from "@/lib/types";

export type EventStatus = "upcoming" | "open" | "closed";

export function eventStatus(event: Event): EventStatus {
  const now = Date.now();
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "closed";
  return "open";
}
