import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChapterRecordForm } from "@/components/chapter-record-form";
import { deleteNote, deleteChapterFile } from "./actions";
import { allowedKeys } from "@/lib/permissions";
import type { ChapterNote, ChapterFile, Profile } from "@/lib/types";

type Tab = "chapter" | "exec";

function recordTime(n: ChapterNote) {
  return new Date(n.meeting_at ?? n.created_at);
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

  const [{ data: profile }, { data: notes }, { data: files }, { data: profiles }, { data: permRows }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
      supabase.from("chapter_notes").select("*").returns<ChapterNote[]>(),
      supabase.from("chapter_files").select("*").returns<ChapterFile[]>(),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("role_permissions").select("*"),
    ]);

  // Exec (and admins) write records and see the Exec tab; the database
  // enforces both, so non-exec never receive exec rows at all.
  const allowed = allowedKeys(profile!, permRows ?? []);
  const canWrite = allowed.has("post_chapter_records");
  const seesExec = allowed.has("view_exec_chapter");
  const tab: Tab = seesExec && tabParam === "exec" ? "exec" : "chapter";
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const tabNotes = (notes ?? [])
    .filter((n) => n.category === tab)
    .sort((a, b) => recordTime(b).getTime() - recordTime(a).getTime());
  const tabFiles = (files ?? []).filter((f) => f.category === tab);

  const filesByNote = new Map<string, ChapterFile[]>();
  const looseFiles: ChapterFile[] = [];
  for (const f of tabFiles) {
    if (f.note_id) filesByNote.set(f.note_id, [...(filesByNote.get(f.note_id) ?? []), f]);
    else looseFiles.push(f);
  }

  const urlByFileId = new Map(
    await Promise.all(
      tabFiles.map(async (file) => {
        if (file.external_url) return [file.id, file.external_url] as const;
        const { data } = await supabase.storage
          .from("chapter-files")
          .createSignedUrl(file.storage_path, 300);
        return [file.id, data?.signedUrl ?? null] as const;
      }),
    ),
  );

  const folderKeys = Array.from(
    new Set([...tabNotes.map((n) => n.folder), ...looseFiles.map((f) => f.folder)]),
  ).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const folderNames = folderKeys.filter(Boolean);

  function FileRow({ file }: { file: ChapterFile }) {
    const url = urlByFileId.get(file.id);
    return (
      <li className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate">
          {file.external_url ? "🔗 " : "📄 "}
          {file.title}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-acacia-green hover:underline"
            >
              {file.external_url ? "Open" : "Download"}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Unavailable</span>
          )}
          {canWrite && !file.note_id && (
            <form action={deleteChapterFile.bind(null, file.id, file.storage_path)}>
              <button className="text-xs text-red-600 hover:underline">Delete</button>
            </form>
          )}
        </span>
      </li>
    );
  }

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
        {seesExec && (
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

      {canWrite && <ChapterRecordForm userId={user!.id} category={tab} folders={folderNames} />}

      {folderKeys.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      )}

      {folderKeys.map((folder) => (
        <section key={folder || "__unfiled"} className="space-y-3">
          <h2 className="text-sm font-medium text-muted">{folder ? `📁 ${folder}` : "Unfiled"}</h2>

          <ul className="space-y-3">
            {tabNotes
              .filter((n) => n.folder === folder)
              .map((note) => {
                const attached = filesByNote.get(note.id) ?? [];
                return (
                  <li key={note.id} className="rounded-lg border border-surface-border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{note.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {recordTime(note).toLocaleString([], {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          · posted by {nameById.get(note.created_by) ?? "Unknown"}
                        </p>
                      </div>
                      {canWrite && (
                        <form action={deleteNote.bind(null, note.id)}>
                          <button className="text-xs text-red-600 hover:underline">Delete</button>
                        </form>
                      )}
                    </div>
                    {note.content && (
                      <p className="mt-2 text-sm whitespace-pre-wrap">{note.content}</p>
                    )}
                    {attached.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-surface-border pt-2">
                        {attached.map((f) => (
                          <FileRow key={f.id} file={f} />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
          </ul>

          {looseFiles.some((f) => f.folder === folder) && (
            <ul className="space-y-1.5 rounded-lg border border-surface-border p-3">
              {looseFiles
                .filter((f) => f.folder === folder)
                .map((f) => (
                  <FileRow key={f.id} file={f} />
                ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
