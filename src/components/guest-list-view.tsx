"use client";

import { useMemo, useState } from "react";
import { GuestRow, type GuestRowData } from "@/components/guest-row";
import type { ExistingGuest, PreviousGuest } from "@/components/guest-form";

type SortKey = "first" | "last" | "referral" | "house" | "checked" | "added";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "first", label: "First name (A–Z)" },
  { id: "last", label: "Last name (A–Z)" },
  { id: "referral", label: "Brother referral" },
  { id: "house", label: "House" },
  { id: "checked", label: "Checked in first" },
  { id: "added", label: "Order added" },
];

const cmp = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

const field =
  "rounded-md border border-surface-border bg-surface px-2 py-1.5 text-sm";

// Rows arrive in the order they were added; sorting and filtering are
// view-only, so nothing here touches the database.
export function GuestListView({
  rows,
  eventId,
  previous,
  existing,
}: {
  rows: GuestRowData[];
  eventId: string;
  previous: PreviousGuest[];
  existing: ExistingGuest[];
}) {
  const [sort, setSort] = useState<SortKey>("first");
  const [query, setQuery] = useState("");
  const [referral, setReferral] = useState("");
  const [house, setHouse] = useState("");
  const [gender, setGender] = useState("");

  const referrals = useMemo(
    () => [...new Set(rows.map((r) => r.referralName))].sort(cmp),
    [rows],
  );
  const houses = useMemo(
    () => [...new Set(rows.map((r) => r.house).filter(Boolean))].sort(cmp),
    [rows],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const indexed = rows.map((r, i) => ({ r, i }));
    const filtered = indexed.filter(({ r }) => {
      if (referral && r.referralName !== referral) return false;
      if (house && r.house !== house) return false;
      if (gender && r.gender !== gender) return false;
      if (q && !`${r.firstName} ${r.lastName}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const byName = (a: GuestRowData, b: GuestRowData) =>
      cmp(a.firstName, b.firstName) || cmp(a.lastName, b.lastName);
    filtered.sort((x, y) => {
      const a = x.r;
      const b = y.r;
      switch (sort) {
        case "last":
          return cmp(a.lastName, b.lastName) || cmp(a.firstName, b.firstName);
        case "referral":
          return cmp(a.referralName, b.referralName) || byName(a, b);
        case "house":
          return cmp(a.house ?? "", b.house ?? "") || byName(a, b);
        case "checked":
          return Number(!!b.checkedInAt) - Number(!!a.checkedInAt) || byName(a, b);
        case "added":
          return x.i - y.i;
        default:
          return byName(a, b);
      }
    });
    return filtered.map((f) => f.r);
  }, [rows, sort, query, referral, house, gender]);

  const filtering = !!(query || referral || house || gender);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name"
          className={`${field} w-40`}
        />
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={field}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <select value={referral} onChange={(e) => setReferral(e.target.value)} className={field}>
          <option value="">All referrals</option>
          {referrals.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select value={house} onChange={(e) => setHouse(e.target.value)} className={field}>
          <option value="">All houses</option>
          {houses.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select value={gender} onChange={(e) => setGender(e.target.value)} className={field}>
          <option value="">All genders</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
        {filtering && (
          <button
            onClick={() => {
              setQuery("");
              setReferral("");
              setHouse("");
              setGender("");
            }}
            className="text-xs underline text-muted-foreground"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtering && (
        <p className="text-xs text-muted-foreground">
          Showing {shown.length} of {rows.length}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {rows.length === 0 ? "Nobody yet." : "No guests match those filters."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((g) => (
            <GuestRow
              key={g.id}
              guest={g}
              eventId={eventId}
              door={false}
              canCheckIn={false}
              previous={previous}
              existing={existing}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
