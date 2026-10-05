"use client";

import { useState, useTransition } from "react";
import {
  createPoll,
  deletePoll,
  deleteSchedule,
  setScheduleActive,
  updatePoll,
} from "@/app/dashboard/polls/actions";

const inputClass = "w-full rounded-md border border-surface-border px-3 py-2 text-sm";

export function NewPollForm() {
  const [open, setOpen] = useState(false);
  const [repeat, setRepeat] = useState("none");
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
              <label className="mb-1 block text-xs font-medium">Repeat</label>
              <select
                name="repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className={`${inputClass} bg-surface`}
              >
                <option value="none">Doesn&apos;t repeat</option>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Every month</option>
              </select>
            </div>
            {repeat === "none" ? (
              <div>
                <label className="mb-1 block text-xs font-medium">Closes (optional)</label>
                <input name="closes_at" type="datetime-local" className={inputClass} />
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    First goes out (blank = now)
                  </label>
                  <input name="first_run" type="datetime-local" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Each one stays open for (hours, blank = until closed)
                  </label>
                  <input name="open_hours" type="number" min={1} className={inputClass} />
                </div>
              </>
            )}
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
            {repeat !== "none" && (
              <label className="flex items-center gap-2">
                <input type="checkbox" name="close_previous" defaultChecked /> Close the previous
                one when the next goes out
              </label>
            )}
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

export function ScheduleManage({ scheduleId, active }: { scheduleId: string; active: boolean }) {
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
    <div className="flex items-center gap-4 text-xs">
      <button
        disabled={pending}
        onClick={() => run(() => setScheduleActive(scheduleId, !active))}
        className="underline disabled:opacity-50"
      >
        {active ? "Pause" : "Resume"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (confirm("Stop this recurring poll? Polls already sent stay.")) {
            run(() => deleteSchedule(scheduleId));
          }
        }}
        className="text-red-600 underline disabled:opacity-50"
      >
        Delete schedule
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
