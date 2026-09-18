import { createClient } from "@/lib/supabase/server";
import { CheckInButton } from "@/components/check-in-button";
import { eventStatus } from "@/lib/event-status";
import { categoryLabel, categoryBadgeClass } from "@/lib/event-category";
import type { Event, Checkin } from "@/lib/types";

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: false })
    .returns<Event[]>();

  const { data: myCheckins } = await supabase
    .from("checkins")
    .select("*")
    .eq("user_id", user!.id)
    .returns<Checkin[]>();

  const checkedInEventIds = new Set((myCheckins ?? []).map((c) => c.event_id));
  const totalHours = (myCheckins ?? []).reduce((sum, c) => sum + Number(c.hours_earned), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Events</h1>
        {totalHours > 0 && (
          <span className="text-sm text-acacia-green font-medium">
            {totalHours} hour{totalHours === 1 ? "" : "s"} earned
          </span>
        )}
      </div>

      {(!events || events.length === 0) && (
        <p className="text-sm text-muted">No events yet.</p>
      )}

      <ul className="space-y-3">
        {events?.map((event) => {
          const status = eventStatus(event);
          const alreadyCheckedIn = checkedInEventIds.has(event.id);

          return (
            <li
              key={event.id}
              className="rounded-lg border border-surface-border p-4 flex items-start justify-between gap-4"
            >
              <div>
                <p className="font-medium">{event.name}</p>
                {event.description && (
                  <p className="text-sm text-muted">{event.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(event.starts_at).toLocaleString()} –{" "}
                  {new Date(event.ends_at).toLocaleString()}
                </p>
                {event.address && (
                  <p className="text-xs text-muted-foreground">{event.address}</p>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      status === "open"
                        ? "bg-acacia-green/15 text-acacia-green"
                        : status === "upcoming"
                          ? "bg-surface-border text-muted"
                          : "bg-surface-border text-muted-foreground"
                    }`}
                  >
                    {status}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(event.category)}`}
                  >
                    {categoryLabel(event.category)}
                  </span>
                  {event.hours > 0 && (
                    <span className="inline-block rounded-full bg-acacia-gold text-acacia-black px-2 py-0.5 text-xs font-medium">
                      {event.hours} hr{event.hours === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {alreadyCheckedIn ? (
                  <span className="text-sm text-acacia-green font-medium">
                    ✓ Checked in
                  </span>
                ) : status === "open" ? (
                  <CheckInButton eventId={event.id} />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {status === "upcoming" ? "Not open yet" : "Closed"}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
