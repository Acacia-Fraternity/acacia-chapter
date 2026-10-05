"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CanvasAuthError, recordCanvasError, syncCanvasGrades } from "@/lib/canvas";

// These use the service-role client (the token table has no RLS policies at
// all), so each action authenticates the caller itself and only ever touches
// the caller's own connection.
async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user.id;
}

export async function connectCanvas(formData: FormData) {
  const userId = await currentUserId();
  const token = String(formData.get("token") ?? "").trim();
  if (token.length < 20) throw new Error("That doesn't look like a Canvas access token");

  const admin = createAdminClient();
  const { error } = await admin
    .from("canvas_connections")
    .upsert({ user_id: userId, access_token: token, last_error: null, connected_at: new Date().toISOString() });
  if (error) throw new Error(error.message);

  try {
    await syncCanvasGrades(admin, userId, token);
  } catch (err) {
    // Don't keep a token that doesn't work.
    await admin.from("canvas_connections").delete().eq("user_id", userId);
    throw err instanceof CanvasAuthError
      ? err
      : new Error("Couldn't reach Canvas — check the token and try again.");
  }
  revalidatePath("/dashboard/grades");
}

export async function refreshCanvas() {
  const userId = await currentUserId();
  const admin = createAdminClient();
  const { data } = await admin
    .from("canvas_connections")
    .select("access_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Canvas isn't connected");

  try {
    await syncCanvasGrades(admin, userId, data.access_token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await recordCanvasError(admin, userId, message);
    throw err;
  }
  revalidatePath("/dashboard/grades");
}

export async function disconnectCanvas() {
  const userId = await currentUserId();
  const admin = createAdminClient();
  await admin.from("canvas_connections").delete().eq("user_id", userId);
  await admin.from("canvas_grades").delete().eq("user_id", userId);
  revalidatePath("/dashboard/grades");
}
