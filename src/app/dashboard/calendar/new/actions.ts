"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chapterWallTimeToIso } from "@/lib/chapter-time";
import { EVENT_CATEGORIES, SOBER_CATEGORIES } from "@/lib/event-category";
import type { EventCategory } from "@/lib/types";

// Same for every event: close enough that the GPS check means "you are
// actually there" without failing people standing at the edge of a venue.
const CHECK_IN_RADIUS_METERS = 100;

export async function createEvent(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const latRaw = String(formData.get("latitude") ?? "");
  const lngRaw = String(formData.get("longitude") ?? "");
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  // Number("") is 0 — an unpicked location must not silently become 0,0.
  if (!latRaw || !lngRaw || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Pick an address from the suggestions so check-in knows where the event is");
  }
  const categoryRaw = String(formData.get("category") ?? "");
  const category = EVENT_CATEGORIES.some((c) => c.value === categoryRaw)
    ? categoryRaw
    : "other";
  // The hours field only exists for Philo events; ignore it otherwise.
  const hours =
    category === "philanthropy"
      ? Math.max(0, Number(formData.get("hours") ?? 0) || 0)
      : 0;
  const startsAt = String(formData.get("starts_at"));
  const endsAt = String(formData.get("ends_at"));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Only social events and parties have sober brothers; the picker only
  // submits ids while "Yes" is chosen, but a stale/forged form must not
  // attach them to another type.
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const soberIds = SOBER_CATEGORIES.includes(category as EventCategory)
    ? Array.from(new Set(formData.getAll("sober_ids").map(String))).filter((id) =>
        uuid.test(id),
      )
    : [];

  const rsvpRequired = formData.get("rsvp_required") === "1";
  const deadlineRaw = String(formData.get("rsvp_deadline") ?? "");
  const rsvpDeadline =
    rsvpRequired && deadlineRaw ? chapterWallTimeToIso(deadlineRaw) : null;
  const assignedIds = Array.from(
    new Set(formData.getAll("assigned_ids").map(String)),
  ).filter((id) => uuid.test(id));

  const { data: created, error } = await supabase.from("events").insert({
    rsvp_required: rsvpRequired,
    rsvp_deadline: rsvpDeadline,
    name,
    description,
    address,
    latitude,
    longitude,
    radius_meters: CHECK_IN_RADIUS_METERS,
    hours,
    category,
    starts_at: chapterWallTimeToIso(startsAt),
    ends_at: chapterWallTimeToIso(endsAt),
    created_by: user.id,
  }).select("id").single();

  if (error || !created) {
    throw new Error(error?.message ?? "Couldn't create the event");
  }

  if (soberIds.length > 0) {
    const { error: soberError } = await supabase
      .from("event_sober_brothers")
      .insert(soberIds.map((user_id) => ({ event_id: created.id, user_id })));
    if (soberError) {
      // Don't leave an event behind that is missing the sober brothers the
      // creator asked for.
      await supabase.from("events").delete().eq("id", created.id);
      throw new Error(soberError.message);
    }
  }

  if (assignedIds.length > 0) {
    const { error: assignError } = await supabase
      .from("event_assignments")
      .insert(assignedIds.map((user_id) => ({ event_id: created.id, user_id })));
    if (assignError) {
      await supabase.from("events").delete().eq("id", created.id);
      throw new Error(assignError.message);
    }
  }

  redirect("/dashboard/calendar");
}
