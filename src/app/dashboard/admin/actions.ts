"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * These only ever change `role`/`can_chat`/`can_react` through Supabase's
 * normal update path — the actual enforcement that a non-admin can't call
 * this on themselves (or anyone) lives in the database (RLS policy +
 * `prevent_self_privilege_escalation` trigger, see supabase/schema.sql),
 * not here. If a non-admin somehow reaches this action, the update fails
 * and we surface that failure rather than silently doing nothing.
 */
async function updateProfileField(
  userId: string,
  field: "role" | "can_chat" | "can_react",
  value: string | boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ [field]: value })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
}

export async function setMemberRole(userId: string, role: "member" | "admin") {
  await updateProfileField(userId, "role", role);
}

export async function setMemberCanChat(userId: string, canChat: boolean) {
  await updateProfileField(userId, "can_chat", canChat);
}

export async function setMemberCanReact(userId: string, canReact: boolean) {
  await updateProfileField(userId, "can_react", canReact);
}
