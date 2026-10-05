"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chapterWallTimeToIso } from "@/lib/chapter-time";
import { EVENT_CATEGORIES } from "@/lib/event-category";

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

  const { error } = await supabase.from("events").insert({
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
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/dashboard/calendar");
}
