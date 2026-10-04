"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function categoryFrom(formData: FormData): "chapter" | "exec" {
  return formData.get("category") === "exec" ? "exec" : "chapter";
}

function folderFrom(formData: FormData): string {
  return String(formData.get("folder") ?? "").trim();
}

export async function createNote(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const { error } = await supabase.from("chapter_notes").insert({
    title,
    content,
    category: categoryFrom(formData),
    folder: folderFrom(formData),
    created_by: user.id,
  });
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
    category: categoryFrom(formData),
    folder: folderFrom(formData),
    uploaded_by: user.id,
  });
  if (dbError) throw new Error(dbError.message);

  revalidatePath("/dashboard/chapter");
}

// Stand-in for Google Drive sync: a link to a Drive doc/folder filed
// alongside uploads. Real sync needs a Google Cloud OAuth app.
export async function addDriveLink(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!title || !url) throw new Error("A title and a link are both required");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid link");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Links must start with http:// or https://");
  }

  const { error } = await supabase.from("chapter_files").insert({
    title,
    storage_path: "",
    external_url: parsed.toString(),
    category: categoryFrom(formData),
    folder: folderFrom(formData),
    uploaded_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/chapter");
}

export async function deleteChapterFile(id: string, storagePath: string) {
  const supabase = await createClient();
  if (storagePath) await supabase.storage.from("chapter-files").remove([storagePath]);
  const { error } = await supabase.from("chapter_files").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/chapter");
}
