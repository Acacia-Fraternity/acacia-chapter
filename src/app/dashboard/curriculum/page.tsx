import { CurriculumQuiz } from "@/components/curriculum-quiz";
import { drawQuiz, questionBank, sectionCounts } from "@/lib/curriculum/generator";

const COUNTS = [10, 25, 50];

// A fresh seed per page load means every "Start quiz" draws a different set.
const newSeed = () => Math.random().toString(36).slice(2);

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; n?: string; seed?: string }>;
}) {
  const { section, n, seed } = await searchParams;
  const total = questionBank().length;
  const sections = sectionCounts();

  const count = COUNTS.includes(Number(n)) ? Number(n) : 10;
  const quiz = seed
    ? drawQuiz({ section: section || undefined, count, seed })
    : null;

  const restartHref = `/dashboard/curriculum?${new URLSearchParams({
    ...(section ? { section } : {}),
    n: String(count),
    seed: newSeed(),
  })}`;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Curriculum</h1>
      <p className="text-sm text-muted-foreground">
        {total.toLocaleString()} questions built from{" "}
        <a
          href="https://issuu.com/acaciahq/docs/pythagoras-2016-01__issuu_"
          target="_blank"
          rel="noreferrer"
          className="text-acacia-blue underline"
        >
          Pythagoras (2016 edition)
        </a>
        , the Acacia membership manual. Pick a chapter of the manual or take a
        mixed quiz.
      </p>

      {quiz ? (
        <CurriculumQuiz key={seed} questions={quiz} restartHref={restartHref} />
      ) : (
        <form
          method="get"
          className="rounded-lg border border-surface-border p-4 space-y-3"
        >
          <input type="hidden" name="seed" value={newSeed()} />
          <label className="block text-sm space-y-1">
            <span className="font-medium">Topic</span>
            <select
              name="section"
              defaultValue=""
              className="w-full rounded-md border border-surface-border bg-surface px-2 py-1.5 text-sm"
            >
              <option value="">All topics ({total.toLocaleString()})</option>
              {sections.map((s) => (
                <option key={s.section} value={s.section}>
                  {s.section} ({s.count})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm space-y-1">
            <span className="font-medium">Length</span>
            <select
              name="n"
              defaultValue="10"
              className="w-full rounded-md border border-surface-border bg-surface px-2 py-1.5 text-sm"
            >
              {COUNTS.map((c) => (
                <option key={c} value={c}>
                  {c} questions
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold"
          >
            Start quiz
          </button>
        </form>
      )}
    </div>
  );
}
