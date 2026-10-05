"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface GalleryItem {
  id: string;
  album: string;
  storagePath: string;
  thumbPath: string;
  thumbUrl: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
}

interface EventOption {
  id: string;
  name: string;
  starts_at: string;
}

const FULL_MAX = 2000;
const THUMB_MAX = 480;
const OTHER = "__other__";

// Phones shoot 4-12 MB photos; shrinking in the browser keeps storage small and
// the grid fast. Thumbnails keep the photo's shape; the grid crops them to
// squares with CSS so every tile lines up regardless of orientation.
async function resizeToJpeg(
  bitmap: ImageBitmap,
  maxSide: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image"))),
      "image/jpeg",
      quality,
    ),
  );
}

export function GalleryView({
  items,
  events,
  currentUserId,
  isAdmin,
  canUpload,
}: {
  items: GalleryItem[];
  events: EventOption[];
  currentUserId: string;
  isAdmin: boolean;
  canUpload: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInput = useRef<HTMLInputElement>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [eventChoice, setEventChoice] = useState<string>(events[0]?.id ?? OTHER);
  const [albumName, setAlbumName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ item: GalleryItem; url: string | null } | null>(null);

  const albums = useMemo(() => {
    const groups = new Map<string, GalleryItem[]>();
    for (const item of items) {
      groups.set(item.album, [...(groups.get(item.album) ?? []), item]);
    }
    // Items arrive newest-first, so Map insertion order already puts the most
    // recently active album on top.
    return Array.from(groups.entries());
  }, [items]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0) return;

    const event = events.find((ev) => ev.id === eventChoice);
    const album = event ? event.name : albumName.trim();
    if (!album) {
      setError("Name the album (or pick an event).");
      return;
    }

    let done = 0;
    const failed: string[] = [];
    for (const file of files) {
      setProgress(`Uploading ${done + 1} of ${files.length}…`);
      try {
        const bitmap = await createImageBitmap(file);
        const [full, thumb] = await Promise.all([
          resizeToJpeg(bitmap, FULL_MAX, 0.85),
          resizeToJpeg(bitmap, THUMB_MAX, 0.8),
        ]);
        const id = crypto.randomUUID();
        const storagePath = `${currentUserId}/${id}.jpg`;
        const thumbPath = `${currentUserId}/${id}-thumb.jpg`;

        const opts = { contentType: "image/jpeg" };
        const up1 = await supabase.storage.from("gallery").upload(storagePath, full, opts);
        if (up1.error) throw up1.error;
        const up2 = await supabase.storage.from("gallery").upload(thumbPath, thumb, opts);
        if (up2.error) throw up2.error;

        const { error: insertError } = await supabase.from("gallery_photos").insert({
          user_id: currentUserId,
          event_id: event?.id ?? null,
          album,
          storage_path: storagePath,
          thumb_path: thumbPath,
          width: bitmap.width,
          height: bitmap.height,
        });
        if (insertError) throw insertError;
      } catch {
        failed.push(file.name);
      }
      done += 1;
    }

    setProgress(null);
    if (failed.length) {
      setError(`Couldn't upload: ${failed.join(", ")}. Only photos (JPEG/PNG/HEIC) work.`);
    } else {
      setFiles([]);
      setShowUpload(false);
      if (fileInput.current) fileInput.current.value = "";
    }
    router.refresh();
  }

  async function openPhoto(item: GalleryItem) {
    setOpen({ item, url: null });
    const { data } = await supabase.storage
      .from("gallery")
      .createSignedUrl(item.storagePath, 600);
    setOpen((cur) => (cur?.item.id === item.id ? { item, url: data?.signedUrl ?? null } : cur));
  }

  async function remove(item: GalleryItem) {
    if (!confirm("Delete this photo?")) return;
    const { error: deleteError } = await supabase
      .from("gallery_photos")
      .delete()
      .eq("id", item.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await supabase.storage.from("gallery").remove([item.storagePath, item.thumbPath]);
    setOpen(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Gallery</h1>
        {canUpload && <button
          onClick={() => setShowUpload((v) => !v)}
          className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold"
        >
          {showUpload ? "Cancel" : "Add photos"}
        </button>}
      </div>

      {showUpload && (
        <form
          onSubmit={upload}
          className="space-y-3 rounded-lg border border-surface-border p-4"
        >
          <div className="space-y-1">
            <label className="block text-sm font-medium">Album</label>
            <select
              value={eventChoice}
              onChange={(e) => setEventChoice(e.target.value)}
              className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} —{" "}
                  {new Date(ev.starts_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </option>
              ))}
              <option value={OTHER}>Something else…</option>
            </select>
            {eventChoice === OTHER && (
              <input
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                placeholder="Album name"
                maxLength={80}
                className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
              />
            )}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm"
          />

          <button
            type="submit"
            disabled={files.length === 0 || progress !== null}
            className="rounded-md bg-acacia-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {progress ?? `Upload${files.length ? ` ${files.length} photo${files.length > 1 ? "s" : ""}` : ""}`}
          </button>
          <p className="text-xs text-muted-foreground">
            Photos are resized automatically. Everyone in the chapter can see what you add.
          </p>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {albums.length === 0 && (
        <p className="text-sm text-muted-foreground">No photos yet — add the first ones.</p>
      )}

      {albums.map(([album, photos]) => (
        <section key={album} className="space-y-2">
          <h2 className="text-sm font-medium text-muted">
            {album} <span className="text-muted-foreground">· {photos.length}</span>
          </h2>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => openPhoto(photo)}
                className="aspect-square overflow-hidden rounded-md bg-surface-border"
              >
                {photo.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.thumbUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        </section>
      ))}

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
          onClick={() => setOpen(null)}
        >
          <div className="flex items-center justify-between text-sm text-white">
            <span>
              {open.item.uploaderName} ·{" "}
              {new Date(open.item.createdAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </span>
            <div className="flex gap-4">
              {(open.item.uploaderId === currentUserId || isAdmin) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(open.item);
                  }}
                  className="text-red-300 underline"
                >
                  Delete
                </button>
              )}
              <button onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center pt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={open.url ?? open.item.thumbUrl}
              alt=""
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
