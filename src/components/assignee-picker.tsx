"use client";

import { useState } from "react";
import type { PickerMember } from "@/components/sober-picker";

// A checklist of every brother, with Select all / Clear for big events.
// Checked ids are submitted as repeated `assigned_ids` fields.
export function AssigneePicker({ members }: { members: PickerMember[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Assign brothers{" "}
          <span className="font-normal text-muted-foreground">
            ({selected.size} of {members.length})
          </span>
        </span>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => setSelected(new Set(members.map((m) => m.id)))}
            className="text-acacia-blue underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-muted underline"
          >
            Clear
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground">No brothers added yet.</p>
      ) : (
        <ul className="max-h-60 overflow-y-auto rounded-md border border-surface-border divide-y divide-surface-border">
          {members.map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-acacia-gold/20">
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                />
                {m.name}
              </label>
            </li>
          ))}
        </ul>
      )}

      {[...selected].map((id) => (
        <input key={id} type="hidden" name="assigned_ids" value={id} />
      ))}
    </div>
  );
}
