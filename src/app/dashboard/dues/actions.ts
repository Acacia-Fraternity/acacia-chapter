"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Every write here is gated by the "admins manage dues" RLS policy, not by
// these functions — a non-admin's insert/update/delete simply affects 0 rows
// or errors.

export async function createDues(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const title = String(formData.get("title") ?? "").trim();
  const dollars = Number(String(formData.get("amount") ?? "").replace(/[$,]/g, ""));
  const dueDate = String(formData.get("due_date") ?? "");
  const audience = String(formData.get("audience") ?? "actives");

  if (!title) throw new Error("Give the charge a name");
  if (!Number.isFinite(dollars) || dollars <= 0) throw new Error("Enter an amount above $0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Pick a due date");

  let query = supabase.from("profiles").select("id");
  if (audience === "actives") query = query.eq("is_pledge", false);
  else if (audience === "pledges") query = query.eq("is_pledge", true);
  const { data: people, error: peopleError } = await query;
  if (peopleError) throw new Error(peopleError.message);
  if (!people?.length) throw new Error("No one matches that group");

  const batchId = crypto.randomUUID();
  const { error } = await supabase.from("dues_charges").insert(
    people.map((p) => ({
      batch_id: batchId,
      user_id: p.id,
      title,
      amount_cents: Math.round(dollars * 100),
      due_date: dueDate,
      created_by: user.id,
    })),
  );
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/dues");
}

export async function setDuePaid(chargeId: string, paid: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dues_charges")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("id", chargeId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only admins can record payments");
  revalidatePath("/dashboard/dues");
}

export async function deleteDuesBatch(batchId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("dues_charges").delete().eq("batch_id", batchId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dues");
}
