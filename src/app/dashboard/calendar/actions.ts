"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// can_edit_calendar() in schema.sql is the real gate (RLS on events); a
// caller without it gets zero rows deleted, which we surface as an error
// rather than silently doing nothing.
export async function deleteEvent(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("You don't have permission to delete events");
  }
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/events");
}
