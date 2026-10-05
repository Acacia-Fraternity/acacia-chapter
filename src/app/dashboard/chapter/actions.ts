"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Records are created in the browser (components/chapter-record-form.tsx) so
// file uploads go straight to Storage instead of through a size-limited server
// action. Who may write is enforced by RLS (exec only), not here.

export async function deleteNote(id: string) {
  const supabase = await createClient();

  // Attached files are removed from the database by cascade, but their bytes
  // in Storage have to be deleted explicitly.
  const { data: attached } = await supabase
    .from("chapter_files")
    .select("storage_path")
    .eq("note_id", id);
  const paths = (attached ?? []).map((f) => f.storage_path).filter(Boolean);
  if (paths.length > 0) await supabase.storage.from("chapter-files").remove(paths);

  const { error } = await supabase.from("chapter_notes").delete().eq("id", id);
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
