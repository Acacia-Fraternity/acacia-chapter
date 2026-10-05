"use client";

import { useState, useTransition } from "react";
import { votePoll } from "@/app/dashboard/polls/actions";

export function PollVoteForm({
  pollId,
  options,
  allowMultiple,
  onDone,
}: {
  pollId: string;
  options: string[];
  allowMultiple: boolean;
  onDone?: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(i: number) {
    setSelected((prev) =>
      allowMultiple
        ? prev.includes(i)
          ? prev.filter((x) => x !== i)
          : [...prev, i]
        : [i],
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await votePoll(pollId, selected);
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't submit");
      }
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {options.map((option, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-surface-border px-3 py-2 text-sm hover:bg-acacia-gold/10">
              <input
                type={allowMultiple ? "checkbox" : "radio"}
                name={`poll-${pollId}`}
                checked={selected.includes(i)}
                onChange={() => toggle(i)}
              />
              {option}
            </label>
          </li>
        ))}
      </ul>
      {allowMultiple && (
        <p className="text-xs text-muted-foreground">Select all that apply.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={pending || selected.length === 0}
        className="rounded-md bg-acacia-gold text-acacia-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit answer"}
      </button>
    </div>
  );
}
