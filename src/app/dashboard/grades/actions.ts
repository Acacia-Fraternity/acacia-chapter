"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// The "members manage their own grades" RLS policy is what keeps this to the
// caller's own rows; these only shape the input.

export async function saveGrade(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const course = String(formData.get("course_name") ?? "").trim();
  const score = Number(String(formData.get("score") ?? "").replace("%", ""));
  if (!course) throw new Error("Enter the course name");
  if (!Number.isFinite(score) || score < 0 || score > 150) {
    throw new Error("Enter a percentage like 87.5");
  }

  // Same course name again = update the grade, not a duplicate row.
  const { error } = await supabase
    .from("course_grades")
    .upsert(
      { user_id: user.id, course_name: course, score, updated_at: new Date().toISOString() },
      { onConflict: "user_id,course_name" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/grades");
}

export async function deleteGrade(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("course_grades").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/grades");
}
