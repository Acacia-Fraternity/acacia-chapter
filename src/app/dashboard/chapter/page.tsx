import { createClient } from "@/lib/supabase/server";
import {
  createNote,
  deleteNote,
  uploadChapterFile,
  deleteChapterFile,
} from "./actions";
import type { ChapterNote, ChapterFile, Profile } from "@/lib/types";

export default async function ChapterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: notes }, { data: files }, { data: profiles }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
      supabase
        .from("chapter_notes")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<ChapterNote[]>(),
      supabase
        .from("chapter_files")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<ChapterFile[]>(),
      supabase.from("profiles").select("id, full_name"),
    ]);

  const isAdmin = profile?.role === "admin";
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const fileLinks = await Promise.all(
    (files ?? []).map(async (file) => {
      const { data } = await supabase.storage
        .from("chapter-files")
        .createSignedUrl(file.storage_path, 300);
      return [file.id, data?.signedUrl ?? null] as const;
    }),
  );
  const urlByFileId = new Map(fileLinks);

  return (
    <div className="space-y-10">
      <h1 className="text-lg font-semibold">Chapter</h1>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted">Meeting notes</h2>

        {isAdmin && (
          <form action={createNote} className="space-y-2 rounded-lg border border-surface-border p-3">
            <input
              name="title"
              placeholder="Title (e.g. Sept 15 Chapter Meeting)"
              required
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
            />
            <textarea
              name="content"
              rows={4}
              placeholder="Notes…"
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold"
            >
              Post note
            </button>
          </form>
        )}

        {(!notes || notes.length === 0) && (
          <p className="text-sm text-muted-foreground">No meeting notes yet.</p>
        )}

        <ul className="space-y-3">
          {notes?.map((note) => (
            <li key={note.id} className="rounded-lg border border-surface-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{note.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {nameById.get(note.created_by) ?? "Unknown"} ·{" "}
                    {new Date(note.created_at).toLocaleDateString()}
                  </p>
                </div>
                {isAdmin && (
                  <form action={deleteNote.bind(null, note.id)}>
                    <button className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  </form>
                )}
              </div>
              {note.content && (
                <p className="mt-2 text-sm whitespace-pre-wrap">{note.content}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted">
          Slides &amp; files
        </h2>

        {isAdmin && (
          <form
            action={uploadChapterFile}
            encType="multipart/form-data"
            className="space-y-2 rounded-lg border border-surface-border p-3"
          >
            <input
              name="title"
              placeholder="Title (optional — defaults to filename)"
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
            />
            <input name="file" type="file" required className="text-sm" />
            <button
              type="submit"
              className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold"
            >
              Upload
            </button>
          </form>
        )}

        {(!files || files.length === 0) && (
          <p className="text-sm text-muted-foreground">No files yet.</p>
        )}

        <ul className="space-y-2">
          {files?.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between rounded-md border border-surface-border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{file.title}</p>
                <p className="text-xs text-muted-foreground">
                  {nameById.get(file.uploaded_by) ?? "Unknown"} ·{" "}
                  {new Date(file.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {urlByFileId.get(file.id) ? (
                  <a
                    href={urlByFileId.get(file.id)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-acacia-blue hover:underline"
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">Unavailable</span>
                )}
                {isAdmin && (
                  <form action={deleteChapterFile.bind(null, file.id, file.storage_path)}>
                    <button className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
