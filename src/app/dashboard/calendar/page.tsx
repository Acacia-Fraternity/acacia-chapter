import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/calendar-view";
import { allowedKeys } from "@/lib/permissions";
import type { Event, Checkin, Profile } from "@/lib/types";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: events }, { data: myCheckins }, { data: sober }, { data: people }, { data: permRows }] =
    await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("events").select("*").returns<Event[]>(),
    supabase
      .from("checkins")
      .select("*")
      .eq("user_id", user!.id)
      .returns<Checkin[]>(),
    supabase.from("event_sober_brothers").select("event_id, user_id"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("role_permissions").select("*"),
  ]);

  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name || "Unknown"]));
  const soberByEvent: Record<string, string[]> = {};
  for (const row of sober ?? []) {
    (soberByEvent[row.event_id] ??= []).push(nameById.get(row.user_id) ?? "Unknown");
  }

  return (
    <CalendarView
      events={events ?? []}
      checkedInEventIds={(myCheckins ?? []).map((c) => c.event_id)}
      // Mirrors can_edit_calendar() in schema.sql, which is what actually enforces it.
      soberByEvent={soberByEvent}
      allowedViews={(["day", "week", "month"] as const).filter((v) =>
        allowedKeys(profile!, permRows ?? []).has(`calendar_view_${v}`),
      )}
      canEdit={
        profile?.role === "admin" ||
        (profile?.can_edit_calendar ?? false) ||
        allowedKeys(profile!, permRows ?? []).has("edit_calendar")
      }
    />
  );
}
