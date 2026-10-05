import Link from "next/link";
import { CurriculumQuiz } from "@/components/curriculum-quiz";
import { drawQuiz, questionBank } from "@/lib/curriculum/generator";
import { chapterToday } from "@/lib/dues";
import {
  COMPRESSION_NOTE,
  INITIATION_CHECKLIST,
  KEY_DATES,
  MOTTO,
  PHILOSOPHY,
  PLEDGE_WEEKS,
  STANDING_EXPECTATIONS,
  THREE_AS,
} from "@/lib/pledgeship";

// A fresh seed per page load means every visit gets a different random order.
const newSeed = () => Math.random().toString(36).slice(2);

function Tabs({ tab }: { tab: "schedule" | "quizzes" }) {
  return (
    <div className="flex gap-2">
      {(
        [
          ["schedule", "Schedule"],
          ["quizzes", "Quizzes"],
        ] as const
      ).map(([value, label]) => (
        <Link
          key={value}
          href={`/dashboard/pledgeship?tab=${value}`}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            tab === value ? "border-acacia-gold bg-acacia-gold/25" : "border-surface-border"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function formatWeekDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-sm">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

function Schedule() {
  const today = chapterToday();
  // The current week is the latest one that has started.
  const current = [...PLEDGE_WEEKS].reverse().find((w) => w.date <= today)?.week ?? 0;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          Fall 2026 Pledge Education — 6-week condensed edition
        </p>
        <p className="text-xs text-muted-foreground">
          {MOTTO} · {THREE_AS}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Weekly schedule</h2>
        {PLEDGE_WEEKS.map((w) => (
          <article
            key={w.week}
            className={`space-y-3 rounded-lg border p-4 ${
              w.week === current
                ? "border-acacia-gold bg-acacia-gold/10"
                : "border-surface-border"
            } ${w.week < current ? "opacity-70" : ""}`}
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                Week {w.week}
                <span className="ml-2 text-sm font-normal text-muted">
                  {formatWeekDate(w.date)}
                </span>
              </h3>
              {w.week === current && (
                <span className="rounded-full bg-acacia-gold px-2 py-0.5 text-xs font-semibold text-acacia-black">
                  This week
                </span>
              )}
            </header>

            <div className="flex flex-wrap gap-1.5">
              {w.pillars.map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-surface-border px-2 py-0.5 text-[11px] text-muted"
                >
                  {p}
                </span>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Content &amp; reading
                </h4>
                <Bullets items={w.reading} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Quiz
                </h4>
                <Bullets items={w.quiz} />
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Activities &amp; events
              </h4>
              <Bullets items={w.activities} />
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="font-semibold">Gold Book:</span> {w.goldBook}
            </p>
          </article>
        ))}
        <p className="text-xs text-muted-foreground">{COMPRESSION_NOTE}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Key dates</h2>
        <ul className="space-y-1 text-sm">
          {KEY_DATES.map((d) => (
            <li key={d.date}>
              <span className="font-semibold">{d.date}</span> — {d.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Standing expectations — all 6 weeks</h2>
        {STANDING_EXPECTATIONS.map((g) => (
          <div key={g.heading} className="space-y-1">
            <h3 className="text-sm font-semibold">{g.heading}</h3>
            <Bullets items={g.items} />
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Initiation requirements checklist</h2>
        <ul className="space-y-1 text-sm">
          {INITIATION_CHECKLIST.map((c) => (
            <li key={c.item} className="flex justify-between gap-3">
              <span>☐ {c.item}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{c.pillar}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Pledgeship philosophy</h2>
        {PHILOSOPHY.map((p) => (
          <p key={p.slice(0, 24)} className="text-sm">
            {p}
          </p>
        ))}
      </section>
    </div>
  );
}

export default async function PledgeshipPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "quizzes" ? "quizzes" : "schedule";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">Pledgeship</h1>
        {tab === "quizzes" && (
          <span className="text-sm text-muted">
            {questionBank().length.toLocaleString()} questions
          </span>
        )}
      </div>
      <Tabs tab={tab} />

      {tab === "schedule" ? <Schedule /> : <QuizTab />}
    </div>
  );
}

function QuizTab() {
  const seed = newSeed();
  // The browser only ever gets one batch; the quiz reloads for another when it runs out.
  const questions = drawQuiz({ count: 200, seed });
  return <CurriculumQuiz key={seed} questions={questions} />;
}
