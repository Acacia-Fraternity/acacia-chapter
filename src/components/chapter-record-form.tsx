"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const inputClass = "w-full rounded-md border border-surface-border px-3 py-2 text-sm";

// datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's own zone.
function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ChapterRecordForm({
  userId,
  category,
  folders,
}: {
  userId: string;
  category: "chapter" | "exec";
  folders: string[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(nowLocal);
  const [content, setContent] = useState("");
  const [folder, setFolder] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return;
    if (!content.trim() && files.length === 0) {
      setError("Paste some notes or attach a file.");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is over 50 MB.`);
      return;
    }

    setStatus("Saving…");
    const { data: note, error: noteError } = await supabase
      .from("chapter_notes")
      .insert({
        title: title.trim(),
        content: content.trim(),
        category,
        folder: folder.trim(),
        meeting_at: new Date(when).toISOString(),
        created_by: userId,
      })
      .select("id")
      .single();
    if (noteError || !note) {
      setStatus(null);
      setError(noteError?.message ?? "Couldn't save");
      return;
    }

    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      setStatus(`Uploading file ${i + 1} of ${files.length}…`);
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("chapter-files")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) {
        failed.push(file.name);
        continue;
      }
      const { error: rowError } = await supabase.from("chapter_files").insert({
        title: file.name,
        storage_path: path,
        category,
        folder: folder.trim(),
        note_id: note.id,
        uploaded_by: userId,
      });
      if (rowError) {
        await supabase.storage.from("chapter-files").remove([path]);
        failed.push(file.name);
      }
    }

    setStatus(null);
    router.refresh();
    if (failed.length > 0) {
      setError(`Saved, but these files didn't upload: ${failed.join(", ")}`);
      return;
    }
    setTitle("");
    setContent("");
    setFolder("");
    setFiles([]);
    setWhen(nowLocal());
    if (fileInput.current) fileInput.current.value = "";
    setOpen(false);
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold"
      >
        {open ? "Cancel" : "New record"}
      </button>

      {open && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-surface-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Title (e.g. Chapter meeting)"
              className={inputClass}
            />
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              required
              aria-label="Date and time"
              className={inputClass}
            />
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Paste the notes here…"
            className={inputClass}
          />

          <input
            ref={fileInput}
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm"
          />

          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            list="chapter-folder-options"
            placeholder="Folder (optional, e.g. Rush, Finance)"
            className={inputClass}
          />
          <datalist id="chapter-folder-options">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={status !== null}
            className="rounded-md bg-acacia-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {status ?? "Save record"}
          </button>
        </form>
      )}
    </div>
  );
}
