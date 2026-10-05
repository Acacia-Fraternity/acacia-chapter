"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chapterWallTimeToIso } from "@/lib/chapter-time";

// Exec-only writes are enforced by the "exec manage polls" RLS policy, and
// voting rules by submit_poll_vote() — these only shape the input.

function refresh() {
  // "layout" so the required-poll gate in the dashboard layout re-evaluates.
  revalidatePath("/dashboard", "layout");
}

export async function createPoll(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const question = String(formData.get("question") ?? "").trim();
  const options = String(formData.get("options") ?? "")
    .split(/\r?\n/)
    .map((o) => o.trim())
    .filter(Boolean);
  if (!question) throw new Error("Write a question");
  if (options.length < 2) throw new Error("Give at least two options, one per line");
  if (options.length > 12) throw new Error("12 options at most");

  const audience = String(formData.get("audience") ?? "everyone");
  if (!["everyone", "actives", "pledges", "exec"].includes(audience)) {
    throw new Error("Invalid audience");
  }
  const closesRaw = String(formData.get("closes_at") ?? "");

  const { error } = await supabase.from("polls").insert({
    question,
    options,
    allow_multiple: formData.get("allow_multiple") === "on",
    anonymous: formData.get("anonymous") === "on",
    required: formData.get("required") === "on",
    audience,
    closes_at: closesRaw ? chapterWallTimeToIso(closesRaw) : null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function votePoll(pollId: string, optionIndexes: number[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_poll_vote", {
    p_poll_id: pollId,
    p_options: optionIndexes,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function updatePoll(
  pollId: string,
  changes: { closed?: boolean; required?: boolean },
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("polls")
    .update(changes)
    .eq("id", pollId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only exec can change polls");
  refresh();
}

export async function deletePoll(pollId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) throw new Error(error.message);
  refresh();
}
