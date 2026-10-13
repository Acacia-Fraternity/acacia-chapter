"use client";

import { useState, useTransition } from "react";
import { setListClose } from "@/app/dashboard/guest-lists/actions";

// Exec override for when a party's list closes. `defaultLocal` is the current
// close time as a datetime-local value in chapter time.
export function GuestCloseForm({
  eventId,
  defaultLocal,
}: {
  eventId: string;
  defaultLocal: string;
}) {
  const [value, setValue] = useState(defaultLocal);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string) {
    setError(null);
    startTransition(async () => {
      try {
        await setListClose(eventId, next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          List closes
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 block rounded-md border border-surface-border bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <button
          disabled={pending || !value}
          onClick={() => save(value)}
          className="rounded-md border border-surface-border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Save
        </button>
        <button
          disabled={pending}
          onClick={() => save("")}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground underline disabled:opacity-50"
        >
          Reset to Wednesday night
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
