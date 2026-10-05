"use client";

import { useState, useTransition } from "react";
import { createPoll, deletePoll, updatePoll } from "@/app/dashboard/polls/actions";

const inputClass = "w-full rounded-md border border-surface-border px-3 py-2 text-sm";

export function NewPollForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold"
      >
        {open ? "Cancel" : "New poll"}
      </button>

      {open && (
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              try {
                await createPoll(formData);
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't create poll");
              }
            });
          }}
          className="space-y-3 rounded-lg border border-surface-border p-4"
        >
          <input name="question" required placeholder="Question" maxLength={300} className={inputClass} />
          <textarea
            name="options"
            required
            rows={4}
            placeholder={"One option per line\nYes\nNo\nMaybe"}
            className={inputClass}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Who answers</label>
              <select name="audience" defaultValue="everyone" className={`${inputClass} bg-surface`}>
                <option value="everyone">Everyone</option>
                <option value="actives">Actives</option>
                <option value="pledges">Pledges</option>
                <option value="exec">Exec</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Closes (optional)</label>
              <input name="closes_at" type="datetime-local" className={inputClass} />
            </div>
          </div>

          <div className="space-y-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="required" />
              <span>
                <strong>Required</strong> — blocks the app at login until they answer
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allow_multiple" /> Allow more than one answer
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="anonymous" defaultChecked /> Anonymous (exec sees counts, not names)
            </label>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-acacia-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create poll"}
          </button>
        </form>
      )}
    </div>
  );
}

export function PollManage({
  pollId,
  closed,
  required,
}: {
  pollId: string;
  closed: boolean;
  required: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={required}
          disabled={pending}
          onChange={(e) => run(() => updatePoll(pollId, { required: e.target.checked }))}
        />
        Required to use the app
      </label>
      <button
        disabled={pending}
        onClick={() => run(() => updatePoll(pollId, { closed: !closed }))}
        className="underline disabled:opacity-50"
      >
        {closed ? "Reopen" : "Close poll"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this poll and all its answers?")) run(() => deletePoll(pollId));
        }}
        className="text-red-600 underline disabled:opacity-50"
      >
        Delete
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
