"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertParkingSpot(targetUserId: string, formData: FormData) {
  const supabase = await createClient();

  const spot_number = String(formData.get("spot_number") ?? "").trim();
  const license_plate = String(formData.get("license_plate") ?? "").trim();
  const make_model = String(formData.get("make_model") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const { error } = await supabase.from("parking_spots").upsert(
    {
      user_id: targetUserId,
      spot_number,
      license_plate,
      make_model,
      notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/parking");
}

export async function clearParkingSpot(targetUserId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("parking_spots")
    .delete()
    .eq("user_id", targetUserId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/parking");
}
