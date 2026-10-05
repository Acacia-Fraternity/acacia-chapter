import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/calendar-view";
import type { Event, Checkin, Profile } from "@/lib/types";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: events }, { data: myCheckins }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
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
      // Mirrors can_edit_calendar() in schema.sql, which is what actually enforces it.
      canEdit={profile?.role === "admin" || (profile?.can_edit_calendar ?? false)}
    />
  );
}
