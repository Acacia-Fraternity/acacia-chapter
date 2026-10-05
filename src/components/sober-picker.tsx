"use client";

import { useEffect, useRef, useState } from "react";

export interface PickerMember {
  id: string;
  name: string;
}

// "Sobers": a multi-select of brothers. Selected ids are submitted as
// repeated `sober_ids` fields.
export function SoberPicker({ members }: { members: PickerMember[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on a click outside. (An onBlur check closes the list when you click
  // a name, because clicking a label's text doesn't move focus into it.)
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const nameById = new Map(members.map((m) => [m.id, m.name]));

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">Sobers</span>
      <div className="relative" ref={containerRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-md border border-surface-border px-3 py-2 text-left text-sm"
          >
            <span className={selected.length ? "" : "text-muted-foreground"}>
              {selected.length
                ? `${selected.length} sober brother${selected.length === 1 ? "" : "s"} selected`
                : "Choose the sober brothers…"}
            </span>
            <span aria-hidden>▾</span>
          </button>

          {open && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-surface-border bg-surface shadow-lg">
              {members.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-acacia-gold/20">
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                    {m.name}
                  </label>
                </li>
              ))}
            </ul>
          )}

          {selected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-acacia-gold/25 px-2 py-0.5 text-xs font-medium"
                >
                  {nameById.get(id) ?? "Unknown"}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`Remove ${nameById.get(id)}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {selected.map((id) => (
            <input key={id} type="hidden" name="sober_ids" value={id} />
          ))}
      </div>
    </div>
  );
}
