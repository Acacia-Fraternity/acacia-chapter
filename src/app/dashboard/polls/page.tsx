import { createClient } from "@/lib/supabase/server";
import { formatChapterTime } from "@/lib/chapter-time";
import { NewPollForm, PollManage, ScheduleManage } from "@/components/poll-admin-controls";
import { PollVoteForm } from "@/components/poll-vote-form";
import { allowedKeys } from "@/lib/permissions";
import type { Poll, PollSchedule, PollVote, Profile } from "@/lib/types";

const AUDIENCE_LABEL: Record<Poll["audience"], string> = {
  everyone: "Everyone",
  actives: "Actives",
  pledges: "Pledges",
  exec: "Exec",
};

export default async function PollsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: polls }, { data: votes }, { data: people }, { data: schedules }, { data: permRows }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
      supabase.from("polls").select("*").order("created_at", { ascending: false }).returns<Poll[]>(),
      // RLS: my own votes, plus everyone's on non-anonymous polls if I'm exec.
      supabase.from("poll_votes").select("poll_id, user_id, option_index").returns<PollVote[]>(),
      supabase.from("profiles").select("id, full_name, is_pledge"),
      supabase
        .from("poll_schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<PollSchedule[]>(),
      supabase.from("role_permissions").select("*"),
    ]);

  const isExec = profile?.role === "admin" || !!profile?.is_exec;
  const canManage = allowedKeys(profile!, permRows ?? []).has("create_polls");
  const isPledge = !!profile?.is_pledge;
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name || "Unnamed"]));

  const inAudience = (p: Poll) =>
    p.audience === "everyone" ||
    (p.audience === "actives" && !isPledge) ||
    (p.audience === "pledges" && isPledge) ||
    (p.audience === "exec" && isExec);

  const isOver = (p: Poll) =>
    p.closed || (!!p.closes_at && new Date(p.closes_at).getTime() <= new Date().getTime());

  // Counts come from a function that only answers when the caller may see them.
  const counts = new Map<string, Map<number, number>>();
  await Promise.all(
    (polls ?? []).map(async (p) => {
      const { data } = await supabase.rpc("poll_counts", { p_poll_id: p.id });
      counts.set(
        p.id,
        new Map(
          ((data ?? []) as { option_index: number; votes: number }[]).map((r) => [
            r.option_index,
            Number(r.votes),
          ]),
        ),
      );
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Polls</h1>
      </div>
      {canManage && <NewPollForm />}

      {canManage && (schedules ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">Recurring polls</h2>
          {(schedules ?? []).map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border p-3"
            >
              <div className="min-w-0 text-sm">
                <p className="font-medium">{s.question}</p>
                <p className="text-xs text-muted-foreground">
                  {{ weekly: "Every week", biweekly: "Every 2 weeks", monthly: "Every month" }[s.frequency]}
                  {" · "}
                  {AUDIENCE_LABEL[s.audience]}
                  {s.required && " · required"}
                  {s.active
                    ? ` · next ${formatChapterTime(s.next_run_at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                    : " · paused"}
                </p>
              </div>
              <ScheduleManage scheduleId={s.id} active={s.active} />
            </div>
          ))}
        </section>
      )}

      {(polls ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No polls yet.</p>
      )}

      {(polls ?? []).map((poll) => {
        const mine = (votes ?? []).filter((v) => v.poll_id === poll.id && v.user_id === user!.id);
        const answered = mine.length > 0;
        const over = isOver(poll);
        const canVote = inAudience(poll) && !over && !answered;
        const c = counts.get(poll.id) ?? new Map<number, number>();
        const respondents = c.get(-1) ?? 0;
        const showResults = c.size > 0;

        return (
          <article key={poll.id} className="space-y-3 rounded-lg border border-surface-border p-4">
            <header className="space-y-1">
              <h2 className="font-semibold">{poll.question}</h2>
              <p className="text-xs text-muted-foreground">
                {AUDIENCE_LABEL[poll.audience]}
                {poll.anonymous ? " · anonymous" : " · names visible to exec"}
                {poll.required && " · required"}
                {over
                  ? " · closed"
                  : poll.closes_at
                    ? ` · closes ${formatChapterTime(poll.closes_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                    : ""}
              </p>
            </header>

            {canVote && (
              <PollVoteForm
                pollId={poll.id}
                options={poll.options}
                allowMultiple={poll.allow_multiple}
              />
            )}

            {!canVote && !showResults && (
              <p className="text-sm text-muted-foreground">
                {inAudience(poll) ? "Results appear once the poll closes." : "Not for your group."}
              </p>
            )}

            {showResults && (
              <ul className="space-y-1.5">
                {poll.options.map((option, i) => {
                  const n = c.get(i) ?? 0;
                  const pct = respondents ? Math.round((n / respondents) * 100) : 0;
                  const iVoted = mine.some((v) => v.option_index === i);
                  const voters = !poll.anonymous && canManage
                    ? (votes ?? [])
                        .filter((v) => v.poll_id === poll.id && v.option_index === i)
                        .map((v) => nameById.get(v.user_id) ?? "Unknown")
                    : [];
                  return (
                    <li key={i} className="space-y-0.5">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className={iVoted ? "font-semibold" : ""}>
                          {option}
                          {iVoted && " ✓"}
                        </span>
                        <span className="text-muted">
                          {n} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-border">
                        <div className="h-full bg-acacia-gold" style={{ width: `${pct}%` }} />
                      </div>
                      {voters.length > 0 && (
                        <p className="text-xs text-muted-foreground">{voters.join(", ")}</p>
                      )}
                    </li>
                  );
                })}
                <li className="text-xs text-muted-foreground">
                  {respondents} {respondents === 1 ? "person" : "people"} answered
                </li>
              </ul>
            )}

            {canManage && (
              <PollManage pollId={poll.id} closed={poll.closed} required={poll.required} />
            )}
          </article>
        );
      })}
    </div>
  );
}
