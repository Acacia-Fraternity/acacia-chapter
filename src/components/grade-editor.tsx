"use client";

import { useRef, useState, useTransition } from "react";
import { deleteGrade, saveGrade } from "@/app/dashboard/grades/actions";

const inputClass = "rounded-md border border-surface-border px-3 py-2 text-sm";

export function GradeEditor({
  grades,
}: {
  grades: { id: string; course_name: string; score: number; updated_at: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        after?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {grades.length === 0 && (
          <li className="text-sm text-muted-foreground">No courses entered yet.</li>
        )}
        {grades.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{g.course_name}</span>
            <span className="flex items-center gap-3">
              <span className="font-medium">{Number(g.score).toFixed(1)}%</span>
              <button
                disabled={pending}
                onClick={() => run(() => deleteGrade(g.id))}
                className="text-xs text-red-600 underline disabled:opacity-50"
              >
                remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form
        ref={formRef}
        action={(formData) => run(() => saveGrade(formData), () => formRef.current?.reset())}
        className="flex flex-wrap gap-2"
      >
        <input
          name="course_name"
          required
          placeholder="Course (e.g. MATH-M118)"
          maxLength={80}
          className={`${inputClass} min-w-48 flex-1`}
        />
        <input
          name="score"
          required
          inputMode="decimal"
          placeholder="Grade %"
          className={`${inputClass} w-28`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-acacia-gold text-acacia-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Use your current overall percentage from Canvas. Entering a course again updates it. Update
        this before each weekly grade check.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
