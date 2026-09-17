import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/calendar-view";
import type { Event, Checkin } from "@/lib/types";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: events }, { data: myCheckins }] = await Promise.all([
    supabase.from("events").select("*").returns<Event[]>(),
    supabase
      .from("checkins")
      .select("*")
      .eq("user_id", user!.id)
      .returns<Checkin[]>(),
  ]);

  return (
    <CalendarView
      events={events ?? []}
      checkedInEventIds={(myCheckins ?? []).map((c) => c.event_id)}
    />
  );
}
