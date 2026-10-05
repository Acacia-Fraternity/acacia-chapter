"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Question } from "@/lib/curriculum/generator";

export function CurriculumQuiz({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(0);

  const q = questions[index];
  const answered = picked !== null;

  function choose(i: number) {
    if (answered) return;
    setPicked(i);
    setAttempted((a) => a + 1);
    if (i === q.answer) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      // Batch used up: the server component draws a new random batch.
      router.refresh();
      return;
    }
    setPicked(null);
    setIndex((i) => i + 1);
  }

  return (
    <div className="rounded-lg border border-surface-border p-5 space-y-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {score} / {attempted} correct
        </span>
        <span>{q.section}</span>
      </div>

      <p className="text-base leading-relaxed">{q.prompt}</p>

      <ul className="space-y-2">
        {q.options.map((option, i) => {
          const isAnswer = i === q.answer;
          const state = !answered
            ? "border-surface-border hover:border-acacia-gold"
            : isAnswer
              ? "border-acacia-green bg-acacia-green/10"
              : i === picked
                ? "border-red-500 bg-red-500/10"
                : "border-surface-border opacity-60";
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(i)}
                disabled={answered}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm ${state}`}
              >
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {picked === q.answer ? "Correct." : "Not quite."}
          </p>
          {q.explanation && (
            <p className="text-xs text-muted">{q.explanation}</p>
          )}
          <button
            type="button"
            onClick={next}
            className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
