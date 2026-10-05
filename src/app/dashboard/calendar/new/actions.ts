"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chapterWallTimeToIso } from "@/lib/chapter-time";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const radiusMeters = Number(formData.get("radius_meters"));
  const hours = Number(formData.get("hours") ?? 0);
  const housePoints = Math.max(0, Math.trunc(Number(formData.get("house_points") ?? 0)));
  const category =String(formData.get("category") ?? "other");
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
