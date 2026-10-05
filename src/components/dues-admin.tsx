"use client";

import { useState, useTransition } from "react";
import { createDues, setDuePaid, deleteDuesBatch } from "@/app/dashboard/dues/actions";
import { formatDueDate, formatMoney } from "@/lib/dues";

export interface DuesBatch {
  batchId: string;
  title: string;
  amountCents: number;
  dueDate: string;
  rows: { id: string; name: string; paid: boolean }[];
}

const inputClass = "w-full rounded-md border border-surface-border px-3 py-2 text-sm";

export function DuesAdmin({ batches }: { batches: DuesBatch[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium text-muted">Manage dues (admin)</h2>

      <form
        action={(formData) => run(() => createDues(formData))}
        className="grid gap-3 rounded-lg border border-surface-border p-4 sm:grid-cols-2"
      >
        <input name="title" required placeholder="Charge name (e.g. Fall semester dues)" className={`${inputClass} sm:col-span-2`} />
        <input name="amount" required inputMode="decimal" placeholder="Amount ($)" className={inputClass} />
        <input name="due_date" type="date" required className={inputClass} />
        <select name="audience" defaultValue="actives" className={`${inputClass} bg-surface`}>
          <option value="actives">All actives</option>
          <option value="pledges">All pledges</option>
          <option value="everyone">Everyone</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-acacia-gold text-acacia-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Charge everyone in group
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="space-y-2">
        {batches.map((b) => {
          const paidCount = b.rows.filter((r) => r.paid).length;
          return (
            <li key={b.batchId} className="rounded-lg border border-surface-border">
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-3 p-3 text-sm">
                  <span className="font-medium">
                    {b.title} · {formatMoney(b.amountCents)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      due {formatDueDate(b.dueDate)}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {paidCount}/{b.rows.length} paid
                  </span>
                </summary>
                <div className="space-y-1 border-t border-surface-border p-3">
                  {b.rows.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.paid}
                        disabled={pending}
                        onChange={(e) => run(() => setDuePaid(r.id, e.target.checked))}
                      />
                      {r.name}
                    </label>
                  ))}
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${b.title}" for everyone?`)) {
                        run(() => deleteDuesBatch(b.batchId));
                      }
                    }}
                    className="pt-2 text-xs text-red-600 underline"
                  >
                    Delete this charge
                  </button>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
