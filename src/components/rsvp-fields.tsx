"use client";

import { useState } from "react";

// "RSVP?" Yes/No; Yes reveals an optional deadline. The deadline is only
// rendered (so only submitted) while Yes is chosen.
export function RsvpFields() {
  const [required, setRequired] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">RSVP?</span>
        {[
          { label: "Yes", value: true },
          { label: "No", value: false },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setRequired(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              required === opt.value
                ? "border-acacia-gold bg-acacia-gold/25"
                : "border-surface-border"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {required && (
        <div>
          <input type="hidden" name="rsvp_required" value="1" />
          <label className="block text-sm font-medium mb-1">
            RSVP deadline{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            name="rsvp_deadline"
            type="datetime-local"
            className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}
