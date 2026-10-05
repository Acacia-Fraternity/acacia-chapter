import { CurriculumQuiz } from "@/components/curriculum-quiz";
import { drawQuiz } from "@/lib/curriculum/generator";

// A fresh seed per page load means every visit gets a different random order.
const newSeed = () => Math.random().toString(36).slice(2);

export default function CurriculumPage() {
  const seed = newSeed();
  // The browser only ever gets one batch; the quiz reloads for another when it runs out.
  const questions = drawQuiz({ count: 200, seed });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Curriculum</h1>
      <CurriculumQuiz key={seed} questions={questions} />
    </div>
  );
}
