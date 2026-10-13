"use client";

import { useState, useTransition } from "react";
import { removeGuest, setGuestCheckedIn } from "@/app/dashboard/guest-lists/actions";
import { GuestForm, type GuestFormValues, type PreviousGuest } from "@/components/guest-form";

export interface GuestRowData extends GuestFormValues {
  id: string;
  referralName: string;
  checkedInAt: string | null;
  canEdit: boolean;
}

// One guest on the list. In door mode the row is a check-in toggle; in list
// mode it can be edited or removed (when the viewer is allowed to).
export function GuestRow({
  guest,
  eventId,
  door,
  canCheckIn,
  previous,
  referrals,
  myId,
}: {
  guest: GuestRowData;
  eventId: string;
  door: boolean;
  canCheckIn: boolean;
  previous: PreviousGuest[];
  referrals: { id: string; name: string }[];
  myId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (editing) {
    return (
      <li className="rounded-md border border-surface-border p-3">
        <GuestForm
          eventId={eventId}
          guestId={guest.id}
          initial={guest}
          previous={previous}
          referrals={referrals}
          myId={myId}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  const checked = !!guest.checkedInAt;
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 ${
        checked ? "border-acacia-green/50 bg-acacia-green/10" : "border-surface-border"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {guest.firstName} {guest.lastName}
          {checked && <span className="ml-2 text-xs font-semibold text-acacia-green">Checked in</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {[
            guest.house,
            guest.gender,
            guest.relationship && `${guest.relationship} of ${guest.referralName}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        {(door || canCheckIn) && (
          <button
            disabled={pending}
            onClick={() => run(() => setGuestCheckedIn(guest.id, !checked))}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${
              checked ? "border border-surface-border" : "bg-acacia-gold text-acacia-black"
            }`}
          >
            {checked ? "Undo" : "Check in"}
          </button>
        )}
        {!door && guest.canEdit && (
          <>
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-surface-border px-3 py-1.5 text-sm"
            >
              Edit
            </button>
            <button
              disabled={pending}
              onClick={() => {
                if (confirm(`Remove ${guest.firstName} ${guest.lastName} from the list?`)) {
                  run(() => removeGuest(guest.id));
                }
              }}
              className="rounded-md border border-surface-border px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </li>
  );
}
