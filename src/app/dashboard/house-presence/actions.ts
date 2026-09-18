"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setLivesInHouse(userId: string, livesInHouse: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ lives_in_house: livesInHouse })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/house-presence");
}
