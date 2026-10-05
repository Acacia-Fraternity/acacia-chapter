"use client";

import { useState } from "react";
import { EVENT_CATEGORIES, SOBER_CATEGORIES } from "@/lib/event-category";
import { SoberPicker, type PickerMember } from "@/components/sober-picker";
import type { EventCategory } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-surface-border px-3 py-2 text-sm";

// Service hours only mean something for Philo events (hours are earned by
// time on site), so the field exists only while that type is selected.
export function EventTypeFields({ members }: { members: PickerMember[] }) {
  const [category, setCategory] = useState<EventCategory>("chapter_meeting");

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as EventCategory)}
          className={inputClass}
        >
          {EVENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {SOBER_CATEGORIES.includes(category) && <SoberPicker members={members} />}

      {category === "philanthropy" && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Service hours (max)
          </label>
          <input
            name="hours"
            type="number"
            step="0.5"
            min={0}
            defaultValue={0}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Brothers check in and out at the address; hours are the time they
            actually spent there, up to this cap. Leave 0 to cap at the
            event&apos;s length.
          </p>
        </div>
      )}
    </>
  );
}
