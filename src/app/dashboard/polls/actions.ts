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

  const repeat = String(formData.get("repeat") ?? "none");
  if (repeat !== "none") {
    if (!["weekly", "biweekly", "monthly"].includes(repeat)) throw new Error("Invalid repeat");
    const firstRaw = String(formData.get("first_run") ?? "");
    const hours = Number(formData.get("open_hours") ?? 0);
    const { error: schedError } = await supabase.from("poll_schedules").insert({
      question,
      options,
      allow_multiple: formData.get("allow_multiple") === "on",
      anonymous: formData.get("anonymous") === "on",
      required: formData.get("required") === "on",
      audience,
      frequency: repeat,
      // Blank = start now.
      next_run_at: firstRaw ? chapterWallTimeToIso(firstRaw) : new Date().toISOString(),
      open_hours: Number.isFinite(hours) && hours > 0 ? Math.round(hours) : null,
      close_previous: formData.get("close_previous") === "on",
      created_by: user.id,
    });
    if (schedError) throw new Error(schedError.message);
    // A first run that is already due goes out right away.
    await supabase.rpc("spawn_due_polls");
    refresh();
    return;
  }

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

export async function setScheduleActive(scheduleId: string, active: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poll_schedules")
    .update({ active })
    .eq("id", scheduleId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only exec can change schedules");
  refresh();
}

export async function deleteSchedule(scheduleId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("poll_schedules").delete().eq("id", scheduleId);
  if (error) throw new Error(error.message);
  refresh();
}
