"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createNote(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const { error } = await supabase
    .from("chapter_notes")
    .insert({ title, content, created_by: user.id });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/chapter");
}

export async function deleteNote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("chapter_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/chapter");
}

export async function uploadChapterFile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim();
  if (!file || file.size === 0) throw new Error("Choose a file to upload");

  const storagePath = `${user.id}/${Date.now()}-${file.name}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("chapter-files")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) throw new Error(uploadError.message);

  const { error: dbError } = await supabase.from("chapter_files").insert({
    title: title || file.name,
    storage_path: storagePath,
    uploaded_by: user.id,
  });
  if (dbError) throw new Error(dbError.message);

  revalidatePath("/dashboard/chapter");
}

export async function deleteChapterFile(id: string, storagePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("chapter-files").remove([storagePath]);
  const { error } = await supabase.from("chapter_files").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/chapter");
}
