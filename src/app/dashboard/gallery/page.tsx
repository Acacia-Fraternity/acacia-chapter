import { createClient } from "@/lib/supabase/server";
import { GalleryView, type GalleryItem } from "@/components/gallery-view";
import { allowedKeys } from "@/lib/permissions";
import type { Event, GalleryPhoto, Profile } from "@/lib/types";

export default async function GalleryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: photos }, { data: events }, { data: people }, { data: permRows }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
      supabase
        .from("gallery_photos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(400)
        .returns<GalleryPhoto[]>(),
      supabase
        .from("events")
        .select("id, name, starts_at")
        .lte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: false })
        .limit(60)
        .returns<Pick<Event, "id" | "name" | "starts_at">[]>(),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("role_permissions").select("*"),
    ]);

  // Thumbnails are signed in one batch so the grid loads without a round trip
  // per photo; full-size images are signed on demand when one is opened.
  const urlByPath = new Map<string, string>();
  if (photos && photos.length > 0) {
    const { data: signed } = await supabase.storage
      .from("gallery")
      .createSignedUrls(
        photos.map((p) => p.thumb_path),
        3600,
      );
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name || "Unnamed"]));

  const items: GalleryItem[] = (photos ?? []).map((p) => ({
    id: p.id,
    album: p.album || "Other photos",
    storagePath: p.storage_path,
    thumbPath: p.thumb_path,
    thumbUrl: urlByPath.get(p.thumb_path) ?? "",
    uploaderId: p.user_id,
    uploaderName: nameById.get(p.user_id) ?? "Unknown",
    createdAt: p.created_at,
  }));

  return (
    <GalleryView
      items={items}
      events={events ?? []}
      currentUserId={user!.id}
      isAdmin={allowedKeys(profile!, permRows ?? []).has("delete_any_gallery_photo")}
      canUpload={allowedKeys(profile!, permRows ?? []).has("upload_gallery")}
    />
  );
}
