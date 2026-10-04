"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RsvpStatus } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

export async function setRsvp(eventId: string, status: RsvpStatus) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("event_rsvps").upsert({
    event_id: eventId,
    user_id: user.id,
    status,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/events");
}

export async function submitExcuse(eventId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("Give a reason for the excuse");

  const { error } = await supabase
    .from("event_excuses")
    .insert({ event_id: eventId, user_id: user.id, reason });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/events");
}

export async function withdrawExcuse(eventId: string, userId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("event_excuses")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/events");
}

export async function reviewExcuse(
  eventId: string,
  userId: string,
  status: "approved" | "denied",
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("event_excuses")
    .update({ status })
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/events");
}

export async function submitFeedback(eventId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const rating = Number(formData.get("rating"));
  const comments = String(formData.get("comments") ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Pick a rating from 1 to 5");
  }

  const { error } = await supabase
    .from("event_feedback")
    .upsert({ event_id: eventId, user_id: user.id, rating, comments });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/events");
}

export async function uploadEventFile(eventId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim();
  if (!file || file.size === 0) throw new Error("Choose a file to upload");

  const storagePath = `events/${eventId}/${Date.now()}-${file.name}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("chapter-files")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) throw new Error(uploadError.message);

  const { error: dbError } = await supabase.from("event_files").insert({
    event_id: eventId,
    title: title || file.name,
    storage_path: storagePath,
    uploaded_by: user.id,
  });
  if (dbError) throw new Error(dbError.message);
  revalidatePath("/dashboard/events");
}

export async function deleteEventFile(id: string, storagePath: string) {
  const { supabase } = await requireUser();
  await supabase.storage.from("chapter-files").remove([storagePath]);
  const { error } = await supabase.from("event_files").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/events");
}
