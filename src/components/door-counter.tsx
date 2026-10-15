"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Anonymous in/out headcount. Polls so two doormen see each other's taps.
export function DoorCounter({
  eventId,
  canWork,
}: {
  eventId: string;
  canWork: boolean;
}) {
  const [counts, setCounts] = useState<{ entered: number; left: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("door_counts", { p_event_id: eventId });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setCounts({ entered: row.entered, left: row.left_count });
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function tap(direction: "in" | "out", undo = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc("door_tap", {
      p_event_id: eventId,
      p_direction: direction,
      p_undo: undo,
    });
    if (err) setError(err.message);
    await load();
    setBusy(false);
  }

  async function resetAll() {
    if (busy) return;
    if (!window.confirm("Reset the check-in and check-out counts to zero for this party?")) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc("door_reset", { p_event_id: eventId });
    if (err) setError(err.message);
    await load();
    setBusy(false);
  }

  const inside = counts ? counts.entered - counts.left : 0;
  const stat = "rounded-lg border border-surface-border bg-surface p-4 text-center";
  const big = "min-h-24 rounded-xl text-xl font-bold disabled:opacity-50 active:scale-[0.98]";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className={stat}>
          <p className="text-xs text-muted-foreground">Checked in</p>
          <p className="text-3xl font-semibold">{counts?.entered ?? "–"}</p>
        </div>
        <div className={stat}>
          <p className="text-xs text-muted-foreground">Checked out</p>
          <p className="text-3xl font-semibold">{counts?.left ?? "–"}</p>
        </div>
        <div className={stat}>
          <p className="text-xs text-muted-foreground">Inside now</p>
          <p className="text-3xl font-semibold text-acacia-green">{counts ? inside : "–"}</p>
        </div>
      </div>

      {canWork ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={busy}
              onClick={() => tap("in")}
              className={`${big} bg-acacia-green text-white`}
            >
              + Check in
            </button>
            <button
              disabled={busy}
              onClick={() => tap("out")}
              className={`${big} bg-acacia-gold text-acacia-black`}
            >
              − Check out
            </button>
          </div>
          <div className="flex justify-center gap-4 text-xs">
            <button
              disabled={busy}
              onClick={() => tap("in", true)}
              className="text-muted-foreground underline disabled:opacity-50"
            >
              Undo last check-in
            </button>
            <button
              disabled={busy}
              onClick={() => tap("out", true)}
              className="text-muted-foreground underline disabled:opacity-50"
            >
              Undo last check-out
            </button>
          </div>
          <div className="flex justify-center">
            <button
              disabled={busy}
              onClick={resetAll}
              className="rounded-md border border-red-600 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
            >
              Reset all
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Only the door crew can change the count.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
