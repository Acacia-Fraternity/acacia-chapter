import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  createNote,
  deleteNote,
  uploadChapterFile,
  addDriveLink,
  deleteChapterFile,
} from "./actions";
import type { ChapterNote, ChapterFile, Profile } from "@/lib/types";

type Tab = "chapter" | "exec";

const inputClass =
  "w-full rounded-md border border-surface-border px-3 py-2 text-sm";
const goldButton =
  "rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold";

function groupByFolder<T extends { folder: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.folder || "";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  // Named folders alphabetically, unfiled items last.
  return Array.from(groups.entries()).sort(([a], [b]) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
  );
}

export default async function ChapterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;

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
  // Exec notes/files are admin-only in the database (RLS); non-admins never
  // receive those rows, so the tab only needs to exist for admins.
  const tab: Tab = isAdmin && tabParam === "exec" ? "exec" : "chapter";
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const tabNotes = (notes ?? []).filter((n) => n.category === tab);
  const tabFiles = (files ?? []).filter((f) => f.category === tab);
  const folderNames = Array.from(
    new Set([...tabNotes.map((n) => n.folder), ...tabFiles.map((f) => f.folder)]),
  ).filter(Boolean);

  const fileLinks = await Promise.all(
    tabFiles.map(async (file) => {
      if (file.external_url) return [file.id, file.external_url] as const;
      const { data } = await supabase.storage
        .from("chapter-files")
        .createSignedUrl(file.storage_path, 300);
      return [file.id, data?.signedUrl ?? null] as const;
    }),
  );
  const urlByFileId = new Map(fileLinks);

  const allFolders = new Set([...tabNotes.map((n) => n.folder), ...tabFiles.map((f) => f.folder)]);
  const folderKeys = Array.from(allFolders).sort((a, b) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
  );
  const notesByFolder = new Map(groupByFolder(tabNotes));
  const filesByFolder = new Map(groupByFolder(tabFiles));

  const folderField = (
    <>
      <input
        name="folder"
        list="folder-options"
        placeholder="Folder (optional, e.g. Rush, Finance)"
        className={inputClass}
      />
      <input type="hidden" name="category" value={tab} />
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold mr-2">Chapter</h1>
        <Link
          href="/dashboard/chapter"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            tab === "chapter" ? "border-acacia-gold bg-acacia-gold/25" : "border-surface-border"
          }`}
        >
          Chapter
        </Link>
        {isAdmin && (
          <Link
            href="/dashboard/chapter?tab=exec"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              tab === "exec" ? "border-acacia-gold bg-acacia-gold/25" : "border-surface-border"
            }`}
          >
            Exec
          </Link>
        )}
      </div>

      <datalist id="folder-options">
        {folderNames.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      {isAdmin && (
        <div className="grid gap-3 md:grid-cols-3">
          <form action={createNote} className="space-y-2 rounded-lg border border-surface-border p-3">
            <p className="text-sm font-medium">New note</p>
            <input
              name="title"
              placeholder="Title (e.g. Sept 15 Chapter Meeting)"
              required
              className={inputClass}
            />
            <textarea name="content" rows={3} placeholder="Notes…" className={inputClass} />
            {folderField}
            <button type="submit" className={goldButton}>
              Post note
            </button>
          </form>

          <form
            action={uploadChapterFile}
            encType="multipart/form-data"
            className="space-y-2 rounded-lg border border-surface-border p-3"
          >
            <p className="text-sm font-medium">Upload a file</p>
            <input name="title" placeholder="Title (optional)" className={inputClass} />
            <input name="file" type="file" required className="text-sm" />
            {folderField}
            <button type="submit" className={goldButton}>
              Upload
            </button>
          </form>

          <form action={addDriveLink} className="space-y-2 rounded-lg border border-surface-border p-3">
            <p className="text-sm font-medium">Link a Google Drive doc</p>
            <input name="title" placeholder="Title" required className={inputClass} />
            <input
              name="url"
              type="url"
              placeholder="https://docs.google.com/…"
              required
              className={inputClass}
            />
            {folderField}
            <button type="submit" className={goldButton}>
              Add link
            </button>
          </form>
        </div>
      )}

      {folderKeys.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing here yet.
        </p>
      )}

      {folderKeys.map((folder) => (
        <section key={folder || "__unfiled"} className="space-y-3">
          <h2 className="text-sm font-medium text-muted">
            {folder ? `📁 ${folder}` : "Unfiled"}
          </h2>

          <ul className="space-y-3">
            {(notesByFolder.get(folder) ?? []).map((note) => (
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
                      <button className="text-xs text-red-600 hover:underline">Delete</button>
                    </form>
                  )}
                </div>
                {note.content && (
                  <p className="mt-2 text-sm whitespace-pre-wrap">{note.content}</p>
                )}
              </li>
            ))}
          </ul>

          <ul className="space-y-2">
            {(filesByFolder.get(folder) ?? []).map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between rounded-md border border-surface-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {file.external_url ? "🔗 " : "📄 "}
                    {file.title}
                  </p>
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
                      className="text-sm text-acacia-green hover:underline"
                    >
                      {file.external_url ? "Open in Drive" : "Download"}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unavailable</span>
                  )}
                  {isAdmin && (
                    <form action={deleteChapterFile.bind(null, file.id, file.storage_path)}>
                      <button className="text-xs text-red-600 hover:underline">Delete</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
