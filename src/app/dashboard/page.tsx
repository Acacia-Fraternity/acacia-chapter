import { createClient } from "@/lib/supabase/server";
import { CheckInButton } from "@/components/check-in-button";
import type { Event, Checkin } from "@/lib/types";

function eventStatus(event: Event): "upcoming" | "open" | "closed" {
  const now = Date.now();
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "closed";
  return "open";
}

export default async function DashboardPage() {
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

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Events</h1>

      {(!events || events.length === 0) && (
        <p className="text-sm text-neutral-500">No events yet.</p>
      )}

      <ul className="space-y-3">
        {events?.map((event) => {
          const status = eventStatus(event);
          const alreadyCheckedIn = checkedInEventIds.has(event.id);

          return (
            <li
              key={event.id}
              className="rounded-lg border border-neutral-200 p-4 flex items-start justify-between gap-4"
            >
              <div>
                <p className="font-medium">{event.name}</p>
                {event.description && (
                  <p className="text-sm text-neutral-500">{event.description}</p>
                )}
                <p className="mt-1 text-xs text-neutral-400">
                  {new Date(event.starts_at).toLocaleString()} –{" "}
                  {new Date(event.ends_at).toLocaleString()}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    status === "open"
                      ? "bg-acacia-green/15 text-acacia-green"
                      : status === "upcoming"
                        ? "bg-neutral-100 text-neutral-600"
                        : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {status}
                </span>
              </div>

              <div className="shrink-0">
                {alreadyCheckedIn ? (
                  <span className="text-sm text-acacia-green font-medium">
                    ✓ Checked in
                  </span>
                ) : status === "open" ? (
                  <CheckInButton eventId={event.id} />
                ) : (
                  <span className="text-sm text-neutral-400">
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
