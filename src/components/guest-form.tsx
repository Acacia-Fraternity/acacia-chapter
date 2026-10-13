"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addGuest, updateGuest } from "@/app/dashboard/guest-lists/actions";
import {
  FRATERNITIES,
  SORORITY_HOUSES,
  NO_HOUSE,
  OTHER_HOUSE,
  GUEST_GENDERS,
  GUEST_RELATIONSHIPS,
} from "@/lib/greek-houses";

export interface PreviousGuest {
  firstName: string;
  lastName: string;
  gender: string;
  house: string;
  relationship: string;
}

export interface GuestFormValues {
  firstName: string;
  lastName: string;
  gender: string;
  relationship: string;
  house: string;
  referralId: string;
}

const field = "w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm";
const label = "block text-xs font-medium text-muted-foreground mb-1";

// Adds a guest to a party list (or edits one, when guestId is set). Typing in
// the name boxes offers people from earlier parties; picking one fills every
// field, and anyone new can just be typed in.
export function GuestForm({
  eventId,
  guestId,
  initial,
  previous,
  referrals,
  myId,
  onDone,
}: {
  eventId: string;
  guestId?: string;
  initial?: GuestFormValues;
  previous: PreviousGuest[];
  referrals: { id: string; name: string }[];
  myId: string;
  onDone?: () => void;
}) {
  const [v, setV] = useState<GuestFormValues>(
    initial ?? {
      firstName: "",
      lastName: "",
      gender: "",
      relationship: "",
      house: "",
      referralId: myId,
    },
  );
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const query = `${v.firstName} ${v.lastName}`.trim().toLowerCase();
  const matches = useMemo(() => {
    if (query.length < 1) return [];
    return previous
      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [previous, query]);

  function set<K extends keyof GuestFormValues>(key: K, value: GuestFormValues[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function pick(p: PreviousGuest) {
    setV((prev) => ({
      ...prev,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      house: p.house,
      relationship: p.relationship,
    }));
    setOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (guestId) await updateGuest(guestId, v);
        else await addGuest(eventId, v);
        if (!guestId) {
          setV({
            firstName: "",
            lastName: "",
            gender: "",
            relationship: "",
            house: "",
            referralId: v.referralId,
          });
        }
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div ref={boxRef} className="relative grid grid-cols-2 gap-3">
        <div>
          <label className={label}>First name</label>
          <input
            className={field}
            value={v.firstName}
            required
            autoComplete="off"
            placeholder="Type to find past guests"
            onChange={(e) => {
              set("firstName", e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
        <div>
          <label className={label}>Last name</label>
          <input
            className={field}
            value={v.lastName}
            required
            autoComplete="off"
            onChange={(e) => {
              set("lastName", e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
        {open && matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border border-surface-border bg-surface shadow-lg">
            <li className="px-3 py-1.5 text-xs text-muted-foreground">
              Been to a past party. Pick one to fill everything in.
            </li>
            {matches.map((p) => (
              <li key={`${p.firstName}|${p.lastName}`}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-acacia-gold/15"
                >
                  <span className="font-medium">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[p.house, p.gender].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Gender</label>
          <select
            className={field}
            required
            value={v.gender}
            onChange={(e) => set("gender", e.target.value)}
          >
            <option value="">Select…</option>
            {GUEST_GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>House affiliation</label>
          <select
            className={field}
            required
            value={v.house}
            onChange={(e) => set("house", e.target.value)}
          >
            <option value="">Select…</option>
            <option value={NO_HOUSE}>{NO_HOUSE}</option>
            <optgroup label="Fraternities">
              {FRATERNITIES.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </optgroup>
            <optgroup label="Sororities">
              {SORORITY_HOUSES.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </optgroup>
            <option value={OTHER_HOUSE}>{OTHER_HOUSE}</option>
          </select>
        </div>
        <div>
          <label className={label}>Relationship to referral</label>
          <select
            className={field}
            required
            value={v.relationship}
            onChange={(e) => set("relationship", e.target.value)}
          >
            <option value="">Select…</option>
            {GUEST_RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Active referral</label>
          <select
            className={field}
            required
            value={v.referralId}
            onChange={(e) => set("referralId", e.target.value)}
          >
            {referrals.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.id === myId ? " (me)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-acacia-gold px-4 py-2 text-sm font-semibold text-acacia-black disabled:opacity-50"
        >
          {pending ? "Saving…" : guestId ? "Save changes" : "Add to list"}
        </button>
        {guestId && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-surface-border px-4 py-2 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
