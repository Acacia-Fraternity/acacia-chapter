import { formatChapterTime } from "@/lib/chapter-time";
import { formatDuration, trackerState, type TrackerState } from "@/lib/tracker-health";
import type { Profile, TrackerOutage, TrackerStatus } from "@/lib/types";

const STATE_LABEL: Record<TrackerState, string> = {
  working: "Working",
  rejected: "Pinging, rejected",
  down: "Down",
  never: "Never connected",
};

const STATE_CLASS: Record<TrackerState, string> = {
  working: "bg-green-600/15 text-green-700 dark:text-green-400",
  rejected: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  down: "bg-red-600/15 text-red-700 dark:text-red-400",
  never: "bg-surface-border text-muted",
};

// Problems first, longest-quiet first, so the people to chase are at the top.
const STATE_ORDER: Record<TrackerState, number> = { down: 0, rejected: 1, working: 2, never: 3 };

const when = (iso: string) =>
  formatChapterTime(iso, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function TrackerHealth({
  members,
  statuses,
  outages,
  nowMs,
}: {
  members: Profile[];
  statuses: TrackerStatus[];
  outages: TrackerOutage[];
  nowMs: number;
}) {
  const statusByUser = new Map(statuses.map((s) => [s.user_id, s]));
  const outagesByUser = new Map<string, TrackerOutage[]>();
  for (const o of outages) {
    const list = outagesByUser.get(o.user_id) ?? [];
    list.push(o);
    outagesByUser.set(o.user_id, list);
  }

  const rows = members
    .map((member) => {
      const status = statusByUser.get(member.id);
      return { member, status, state: trackerState(status, nowMs) };
    })
    .sort((a, b) => {
      if (STATE_ORDER[a.state] !== STATE_ORDER[b.state]) {
        return STATE_ORDER[a.state] - STATE_ORDER[b.state];
      }
      // Within "down", the one that has been silent longest first.
      const at = a.status ? new Date(a.status.last_ping_at).getTime() : 0;
      const bt = b.status ? new Date(b.status.last_ping_at).getTime() : 0;
      return at - bt || a.member.full_name.localeCompare(b.member.full_name);
    });

  const counts = { working: 0, rejected: 0, down: 0, never: 0 } satisfies Record<TrackerState, number>;
  for (const r of rows) counts[r.state] += 1;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {counts.working} working · {counts.rejected} rejected · {counts.down} down ·{" "}
        {counts.never} never connected. &quot;Down&quot; means no ping for over 20
        minutes — phones also go quiet when switched off or out of signal, so
        check before assuming it&apos;s set up wrong. Reload the page to refresh.
      </p>

      <ul className="space-y-1.5">
        {rows.map(({ member, status, state }) => {
          const history = outagesByUser.get(member.id) ?? [];
          const quietFor = status ? nowMs - new Date(status.last_ping_at).getTime() : 0;
          return (
            <li key={member.id} className="rounded-lg border border-surface-border p-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {member.full_name || "Unnamed"}
                  {member.is_pledge && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">pledge</span>
                  )}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_CLASS[state]}`}>
                  {STATE_LABEL[state]}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {state === "never" && "Hasn't sent a single ping yet."}
                {state === "working" &&
                  status &&
                  `Last ping ${when(status.last_ping_at)}${
                    status.last_accuracy !== null ? ` · ±${Math.round(status.last_accuracy)} m` : ""
                  }`}
                {state === "rejected" &&
                  status &&
                  `Last ping ${when(status.last_ping_at)} was ignored: ${
                    status.last_issue === "low-accuracy"
                      ? `GPS accuracy ±${Math.round(status.last_accuracy ?? 0)} m (needs 150 m or better — Precise Location off?)`
                      : "the fix was more than 10 minutes old when it arrived"
                  }.`}
                {state === "down" &&
                  status &&
                  `Went quiet at ${when(status.last_ping_at)} — ${formatDuration(quietFor)} ago.`}
              </p>

              {history.length > 0 && (
                <details className="mt-1.5 text-xs">
                  <summary className="cursor-pointer text-muted">
                    {history.length} past outage{history.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {history.slice(0, 15).map((o) => (
                      <li key={o.id}>
                        {when(o.went_quiet_at)} → {when(o.resumed_at)} (
                        {formatDuration(
                          new Date(o.resumed_at).getTime() - new Date(o.went_quiet_at).getTime(),
                        )}
                        )
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
