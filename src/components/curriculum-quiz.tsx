"use client";

import { useState } from "react";
import Link from "next/link";
import type { Question } from "@/lib/curriculum/generator";

export function CurriculumQuiz({
  questions,
  restartHref,
}: {
  questions: Question[];
  restartHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<Question[]>([]);

  const done = index >= questions.length;

  if (done) {
    return (
      <div className="rounded-lg border border-surface-border p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {score} / {questions.length} correct
        </h2>
        {missed.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Review what you missed:</p>
            <ul className="space-y-3">
              {missed.map((q) => (
                <li key={q.id} className="text-sm">
                  <p>{q.prompt}</p>
                  <p className="text-acacia-green font-medium mt-1">
                    {q.options[q.answer]}
                  </p>
                  {q.explanation && (
                    <p className="text-xs text-muted mt-0.5">{q.explanation}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link
          href={restartHref}
          className="inline-block rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold"
        >
          New quiz
        </Link>
      </div>
    );
  }

  const q = questions[index];
  const answered = picked !== null;

  function choose(i: number) {
    if (answered) return;
    setPicked(i);
    if (i === q.answer) setScore((s) => s + 1);
    else setMissed((m) => [...m, q]);
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  return (
    <div className="rounded-lg border border-surface-border p-5 space-y-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Question {index + 1} of {questions.length}
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
            {index + 1 === questions.length ? "Finish" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
