"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * Accounts here are admin-provisioned, not self-service — there's no public
 * sign-up page. This uses the service-role client (createAdminClient), which
 * bypasses RLS entirely, so the admin check below is the ONLY thing standing
 * between this and anyone calling it — unlike every other write in this app,
 * where the database itself enforces the permission regardless of caller.
 */
export async function createMember(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    throw new Error("Only admins can add members");
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || password.length < 6) {
    throw new Error("Name, email, and a password of at least 6 characters are required");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
}
