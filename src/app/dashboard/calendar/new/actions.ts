"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chapterWallTimeToIso } from "@/lib/chapter-time";
import { EVENT_CATEGORIES } from "@/lib/event-category";

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
  const radiusMeters = Number(formData.get("radius_meters"));
  const hours = Number(formData.get("hours") ?? 0);
  const housePoints = Math.max(0, Math.trunc(Number(formData.get("house_points") ?? 0)));
  const categoryRaw = String(formData.get("category") ?? "");
  const category = EVENT_CATEGORIES.some((c) => c.value === categoryRaw)
    ? categoryRaw
    : "other";
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
    radius_meters: radiusMeters,
    hours,
    house_points: housePoints,
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
