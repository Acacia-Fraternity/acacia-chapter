"use client";

import { useState } from "react";
import { GuestRow, type GuestRowData } from "@/components/guest-row";
import type { PreviousGuest } from "@/components/guest-form";

// The door view: a searchable list where each row is a one-tap check-in.
export function GuestDoorList({
  rows,
  eventId,
  previous,
}: {
  rows: GuestRowData[];
  eventId: string;
  previous: PreviousGuest[];
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((g) => !needle || `${g.firstName} ${g.lastName}`.toLowerCase().includes(needle))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name"
        className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm"
      />
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one matches.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((g) => (
            <GuestRow
              key={g.id}
              guest={g}
              eventId={eventId}
              door
              canCheckIn
              previous={previous}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
