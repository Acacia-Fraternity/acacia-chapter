import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GradeEditor } from "@/components/grade-editor";
import type { CourseGrade, Profile } from "@/lib/types";

const STALE_DAYS = 8;

function scoreClass(score: number) {
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

  const sees = profile?.role === "admin" || !!profile?.on_pledge_committee;
  const isPledge = !!profile?.is_pledge;
  if (!sees && !isPledge) redirect("/dashboard");

  // RLS limits this to the caller's own rows, plus pledges' rows for the committee.
  const [{ data: grades }, { data: people }] = await Promise.all([
    supabase.from("course_grades").select("*").order("course_name").returns<CourseGrade[]>(),
    supabase.from("profiles").select("id, full_name, is_pledge"),
  ]);

  const mine = (grades ?? []).filter((g) => g.user_id === user!.id);
  const pledges = (people ?? [])
    .filter((p) => p.is_pledge)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const today = new Date().getTime();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Grades</h1>
        <p className="text-xs text-muted-foreground">
          Pledges enter their own course grades. The pledge committee and admins can see
          pledges&apos; grades; nobody else can.
        </p>
      </div>

      {isPledge && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Your grades</h2>
          <GradeEditor grades={mine} />
        </section>
      )}

      {sees && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Pledges ({pledges.length})</h2>
          {pledges.length === 0 && (
            <p className="text-sm text-muted-foreground">No one is marked as a pledge yet.</p>
          )}
          {pledges.map((p) => {
            const theirs = (grades ?? []).filter((g) => g.user_id === p.id);
            const latest = theirs.reduce(
              (max, g) => Math.max(max, new Date(g.updated_at).getTime()),
              0,
            );
            const stale = theirs.length === 0 || today - latest > STALE_DAYS * 86_400_000;
            return (
              <div key={p.id} className="rounded-lg border border-surface-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{p.full_name || "Unnamed"}</p>
                  <p className={`text-xs ${stale ? "text-amber-600" : "text-muted-foreground"}`}>
                    {theirs.length === 0
                      ? "Nothing entered"
                      : `Updated ${new Date(latest).toLocaleDateString([], { month: "short", day: "numeric" })}${stale ? " · stale" : ""}`}
                  </p>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {theirs.map((g) => (
                    <li key={g.id} className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{g.course_name}</span>
                      <span className={scoreClass(Number(g.score))}>{Number(g.score).toFixed(1)}%</span>
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
