"use server";

import { randomBytes } from "node:crypto";
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
  field: "role" | "can_chat" | "can_react" | "is_pledge" | "can_edit_calendar" | "is_exec" | "on_pledge_committee",
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

export async function setMemberCanEditCalendar(userId: string, value: boolean) {
  await updateProfileField(userId, "can_edit_calendar", value);
}

export async function setMemberIsExec(userId: string, value: boolean) {
  await updateProfileField(userId, "is_exec", value);
}

export async function setMemberOnPledgeCommittee(userId: string, value: boolean) {
  await updateProfileField(userId, "on_pledge_committee", value);
}

export async function setMemberIsPledge(userId: string, isPledge: boolean) {
  await updateProfileField(userId, "is_pledge", isPledge);
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

/**
 * Passwords are hashed by Supabase and can't be read back, so "forgot my
 * password" means setting a new one. The password is generated server-side and
 * returned once for the admin to hand over. Service-role client again, so the
 * admin check is the only gate.
 */
export async function resetMemberPassword(userId: string): Promise<string> {
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
  if (callerProfile?.role !== "admin") throw new Error("Only admins can reset passwords");

  const password = randomBytes(9).toString("base64url");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);

  return password;
}

export interface BulkMemberRow {
  full_name: string;
  email: string;
  status: "active" | "pledge" | "exec";
  password: string;
}

export interface BulkMemberResult {
  email: string;
  error?: string;
}

/**
 * Creates many accounts at once. The browser sends small batches (a long list
 * in one call would outlive a serverless request). Same trust model as
 * createMember: service-role client, so the admin check below is the only gate.
 */
export async function createMembersBulk(rows: BulkMemberRow[]): Promise<BulkMemberResult[]> {
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
  if (callerProfile?.role !== "admin") throw new Error("Only admins can add members");
  if (rows.length > 25) throw new Error("Too many rows in one batch");

  const admin = createAdminClient();
  const results: BulkMemberResult[] = [];

  for (const row of rows) {
    const email = row.email.trim();
    const fullName = row.full_name.trim();
    if (!fullName || !email || row.password.length < 6) {
      results.push({ email, error: "Needs a name, email, and 6+ character password" });
      continue;
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: row.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      results.push({ email, error: error?.message ?? "Could not create account" });
      continue;
    }

    if (row.status !== "active") {
      // Service role has no auth.uid(), which the privilege trigger allows.
      const { error: flagError } = await admin
        .from("profiles")
        .update(row.status === "pledge" ? { is_pledge: true } : { is_exec: true })
        .eq("id", data.user.id);
      if (flagError) {
        results.push({ email, error: `Created, but couldn't set status: ${flagError.message}` });
        continue;
      }
    }
    results.push({ email });
  }

  revalidatePath("/dashboard/admin");
  return results;
}

export async function setRolePermission(
  role: "pledge" | "active" | "exec",
  permission: string,
  allowed: boolean,
) {
  const supabase = await createClient();
  // The "admins edit role permissions" RLS policy is the real gate.
  const { data, error } = await supabase
    .from("role_permissions")
    .upsert({ role, permission, allowed }, { onConflict: "role,permission" })
    .select("role");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only admins can change role access");
  revalidatePath("/dashboard", "layout");
}
