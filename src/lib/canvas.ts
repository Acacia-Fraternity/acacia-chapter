import type { SupabaseClient } from "@supabase/supabase-js";

// IU's Canvas. Fixed on purpose (not user-supplied): the access token is sent
// to this host, so letting a member type the URL would let them point it
// anywhere.
const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL ?? "https://iu.instructure.com";

interface CanvasCourse {
  id: number;
  name?: string;
  course_code?: string;
  enrollments?: {
    type: string;
    computed_current_score?: number | null;
    computed_current_grade?: string | null;
  }[];
}

export class CanvasAuthError extends Error {}

/**
 * Pulls a student's current-term course grades with their own access token and
 * replaces their rows in canvas_grades. Needs a service-role client (the
 * token table and grade writes have no RLS policies for regular users).
 */
export async function syncCanvasGrades(
  admin: SupabaseClient,
  userId: string,
  token: string,
): Promise<number> {
  const url =
    `${CANVAS_BASE_URL}/api/v1/courses?enrollment_type=student&enrollment_state=active` +
    `&include[]=total_scores&per_page=100`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) {
    throw new CanvasAuthError("Canvas rejected that token — it may have expired or been deleted.");
  }
  if (!response.ok) throw new Error(`Canvas returned ${response.status}`);

  const courses = (await response.json()) as CanvasCourse[];
  const rows = courses
    .filter((c) => c.name || c.course_code)
    .map((c) => {
      const enrollment = c.enrollments?.find((e) => e.type === "student");
      return {
        user_id: userId,
        course_id: c.id,
        course_name: c.name ?? c.course_code ?? "Course",
        current_score: enrollment?.computed_current_score ?? null,
        current_grade: enrollment?.computed_current_grade ?? null,
        synced_at: new Date().toISOString(),
      };
    });

  // Replace, so a dropped course doesn't linger.
  const { error: deleteError } = await admin.from("canvas_grades").delete().eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);
  if (rows.length > 0) {
    const { error } = await admin.from("canvas_grades").insert(rows);
    if (error) throw new Error(error.message);
  }
  await admin
    .from("canvas_connections")
    .update({ last_synced_at: new Date().toISOString(), last_error: null })
    .eq("user_id", userId);

  return rows.length;
}

export async function recordCanvasError(admin: SupabaseClient, userId: string, message: string) {
  await admin.from("canvas_connections").update({ last_error: message }).eq("user_id", userId);
}
