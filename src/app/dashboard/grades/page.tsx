import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CanvasConnect } from "@/components/canvas-connect";
import type { CanvasGrade, Profile } from "@/lib/types";

function scoreText(g: CanvasGrade) {
  if (g.current_score === null) return "—";
  return `${Number(g.current_score).toFixed(1)}%${g.current_grade ? ` (${g.current_grade})` : ""}`;
}

function scoreClass(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score < 70) return "text-red-600 font-semibold";
  if (score < 80) return "text-amber-600";
  return "text-acacia-green";
}

export default async function GradesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  const isAdmin = profile?.role === "admin";
  const sees = isAdmin || profile?.on_pledge_committee;
  const isPledge = !!profile?.is_pledge;
  if (!sees && !isPledge) redirect("/dashboard");

  // RLS already limits this to the caller's own rows, plus pledges' rows for
  // the committee.
  const [{ data: grades }, { data: people }] = await Promise.all([
    supabase.from("canvas_grades").select("*").returns<CanvasGrade[]>(),
    supabase.from("profiles").select("id, full_name, is_pledge"),
  ]);

  // Connection state is only readable with the service role (it holds the
  // token) — fetch just the non-secret columns.
  const admin = createAdminClient();
  const { data: connections } = await admin
    .from("canvas_connections")
    .select("user_id, last_synced_at, last_error");
  const connectionByUser = new Map((connections ?? []).map((c) => [c.user_id, c]));
  const mine = connectionByUser.get(user!.id);

  const myGrades = (grades ?? []).filter((g) => g.user_id === user!.id);
  const pledges = (people ?? []).filter((p) => p.is_pledge);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Grades</h1>
        <p className="text-xs text-muted-foreground">
          Pledges connect their own Canvas. The pledge committee and admins can see pledges&apos;
          current course grades; nobody else can.
        </p>
      </div>

      {isPledge && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Your Canvas</h2>
          <CanvasConnect connected={!!mine} lastError={mine?.last_error ?? null} />
          {mine && (
            <ul className="space-y-1">
              {myGrades.length === 0 && (
                <li className="text-sm text-muted-foreground">No active courses found.</li>
              )}
              {myGrades.map((g) => (
                <li key={g.course_id} className="flex justify-between gap-3 text-sm">
                  <span>{g.course_name}</span>
                  <span className={scoreClass(g.current_score)}>{scoreText(g)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {sees && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Pledges ({pledges.length})</h2>
          {pledges.length === 0 && (
            <p className="text-sm text-muted-foreground">No one is marked as a pledge yet.</p>
          )}
          {pledges
            .sort((a, b) => a.full_name.localeCompare(b.full_name))
            .map((p) => {
              const theirs = (grades ?? []).filter((g) => g.user_id === p.id);
              const conn = connectionByUser.get(p.id);
              return (
                <div key={p.id} className="rounded-lg border border-surface-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{p.full_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">
                      {conn?.last_synced_at
                        ? `Synced ${new Date(conn.last_synced_at).toLocaleDateString([], { month: "short", day: "numeric" })}`
                        : "Not connected"}
                    </p>
                  </div>
                  {conn?.last_error && <p className="text-xs text-red-600">{conn.last_error}</p>}
                  <ul className="mt-1 space-y-0.5">
                    {theirs.map((g) => (
                      <li key={g.course_id} className="flex justify-between gap-3 text-sm">
                        <span className="truncate">{g.course_name}</span>
                        <span className={scoreClass(g.current_score)}>{scoreText(g)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </section>
      )}
    </div>
  );
}
