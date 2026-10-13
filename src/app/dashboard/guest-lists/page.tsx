import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { allowedKeys } from "@/lib/permissions";
import { CHAPTER_TZ, formatChapterTime } from "@/lib/chapter-time";
import { GuestForm, type PreviousGuest } from "@/components/guest-form";
import { GuestRow, type GuestRowData } from "@/components/guest-row";
import { GuestDoorList } from "@/components/guest-door-list";
import { GuestCloseForm } from "@/components/guest-close-form";
import { NO_HOUSE } from "@/lib/greek-houses";
import type { Event, PartyGuest, Profile } from "@/lib/types";

type View = "list" | "door" | "analytics";

const card = "rounded-lg border border-surface-border bg-surface p-4";

function whenLabel(iso: string) {
  return formatChapterTime(iso, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "YYYY-MM-DDTHH:mm" in chapter time, for a datetime-local input.
function toLocalInput(iso: string) {
  return new Date(iso)
    .toLocaleString("sv-SE", { timeZone: CHAPTER_TZ })
    .replace(" ", "T")
    .slice(0, 16);
}

export default async function GuestListsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; view?: string }>;
}) {
  const { event: eventParam, view: viewParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: permRows }, { data: parties }, { data: members }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
      supabase.from("role_permissions").select("*"),
      supabase
        .from("events")
        .select("*")
        .eq("category", "party")
        .order("starts_at", { ascending: true })
        .returns<Event[]>(),
      supabase
        .from("profiles")
        .select("id, full_name, is_pledge")
        .order("full_name")
        .returns<Pick<Profile, "id" | "full_name" | "is_pledge">[]>(),
    ]);

  const allowed = allowedKeys(profile!, permRows ?? []);
  const canManage = allowed.has("manage_guest_lists");
  const canEditCalendar = canManage || allowed.has("edit_calendar") || !!profile?.can_edit_calendar;

  const allParties = parties ?? [];
  if (allParties.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Guest Lists</h1>
        <p className="text-sm text-muted-foreground">
          No parties on the calendar yet. Add an event with the type &quot;Party&quot; and its guest
          list shows up here.
        </p>
      </div>
    );
  }

  // Default to the next party that hasn't ended, else the most recent one.
  const nowMs = new Date().getTime();
  const upcoming = allParties.filter((p) => new Date(p.ends_at).getTime() >= nowMs);
  const event =
    allParties.find((p) => p.id === eventParam) ??
    upcoming[0] ??
    allParties[allParties.length - 1];

  const [{ data: guestRows }, { data: assignment }, { data: closeIso }, { data: history }] =
    await Promise.all([
      supabase
        .from("party_guests")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: true })
        .returns<PartyGuest[]>(),
      supabase
        .from("event_assignments")
        .select("user_id")
        .eq("event_id", event.id)
        .eq("user_id", user!.id),
      supabase.rpc("guest_list_close_at", { p_event_id: event.id }),
      // Everyone who has been on any list, newest first, for the autofill.
      supabase
        .from("party_guests")
        .select("first_name, last_name, gender, house, relationship, created_at")
        .order("created_at", { ascending: false })
        .limit(3000)
        .returns<Pick<PartyGuest, "first_name" | "last_name" | "gender" | "house" | "relationship">[]>(),
    ]);

  const guests = guestRows ?? [];
  const closesAt = (closeIso as string | null) ?? event.starts_at;
  const closed = nowMs > new Date(closesAt).getTime();
  const canAdd = !closed || canManage;
  const canWorkDoor =
    allowed.has("check_in_guests") || canManage || (assignment ?? []).length > 0;

  const nameById = new Map((members ?? []).map((m) => [m.id, m.full_name || "Unnamed"]));
  const referrals = (members ?? [])
    .filter((m) => !m.is_pledge)
    .map((m) => ({ id: m.id, name: m.full_name || "Unnamed" }));

  const seen = new Set<string>();
  const previous: PreviousGuest[] = [];
  for (const h of history ?? []) {
    const key = `${h.first_name}|${h.last_name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    previous.push({
      firstName: h.first_name,
      lastName: h.last_name,
      gender: h.gender,
      house: h.house,
      relationship: h.relationship,
    });
  }

  const requested: View = viewParam === "door" || viewParam === "analytics" ? viewParam : "list";
  const view: View = requested === "door" && !canWorkDoor ? "list" : requested;

  const rows: GuestRowData[] = guests.map((g) => ({
    id: g.id,
    firstName: g.first_name,
    lastName: g.last_name,
    gender: g.gender,
    relationship: g.relationship,
    house: g.house,
    referralId: g.referral_id ?? user!.id,
    referralName: g.referral_id ? (nameById.get(g.referral_id) ?? "a brother") : "a brother",
    checkedInAt: g.checked_in_at,
    canEdit: canManage || (g.added_by === user!.id && !closed),
  }));

  const existing = rows.map((g) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    gender: g.gender,
    house: g.house,
    relationship: g.relationship,
    referralName: g.referralName,
  }));

  // Analytics
  const total = guests.length;
  const female = guests.filter((g) => g.gender === "female").length;
  const checkedIn = guests.filter((g) => g.checked_in_at).length;
  const byHouse = new Map<string, number>();
  for (const g of guests) {
    const h = g.house || NO_HOUSE;
    byHouse.set(h, (byHouse.get(h) ?? 0) + 1);
  }
  const houseCounts = [...byHouse.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const pct = (n: number) => (total === 0 ? "0%" : `${Math.round((n / total) * 1000) / 10}%`);

  const href = (params: { event?: string; view?: View }) => {
    const q = new URLSearchParams();
    q.set("event", params.event ?? event.id);
    if (params.view && params.view !== "list") q.set("view", params.view);
    return `/dashboard/guest-lists?${q.toString()}`;
  };

  const tabs: { id: View; label: string }[] = [
    { id: "list", label: "List" },
    ...(canWorkDoor ? [{ id: "door" as View, label: "Door check-in" }] : []),
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Guest Lists</h1>
        <p className="text-sm text-muted-foreground">
          Add the people you&apos;re bringing to a party. The list closes Wednesday night.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action="/dashboard/guest-lists" className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="party">
            Party
          </label>
          <select
            id="party"
            name="event"
            defaultValue={event.id}
            className="rounded-md border border-surface-border bg-surface px-2 py-1.5 text-sm"
          >
            {allParties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatChapterTime(p.starts_at, { month: "short", day: "numeric" })}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-surface-border px-3 py-1.5 text-sm">Go</button>
        </form>
      </div>

      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{event.name}</p>
            <p className="text-xs text-muted-foreground">{whenLabel(event.starts_at)}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              closed ? "bg-surface-border text-muted" : "bg-acacia-green/15 text-acacia-green"
            }`}
          >
            {closed ? "List closed" : "List open"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {closed
            ? `Closed ${whenLabel(closesAt)}.${canManage ? " Exec can still add and refine." : " Exec are refining it now."}`
            : `Closes ${whenLabel(closesAt)}.`}
        </p>
        {canEditCalendar && (
          <GuestCloseForm eventId={event.id} defaultLocal={toLocalInput(closesAt)} />
        )}
      </div>

      <nav className="flex gap-1 border-b border-surface-border">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={href({ view: t.id })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              view === t.id
                ? "border-acacia-gold font-semibold"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {view === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={card}>
              <p className="text-xs text-muted-foreground">Total guests</p>
              <p className="text-2xl font-semibold">{total}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-muted-foreground">Female</p>
              <p className="text-2xl font-semibold">{pct(female)}</p>
              <p className="text-xs text-muted-foreground">
                {female} of {total}
              </p>
            </div>
            <div className={card}>
              <p className="text-xs text-muted-foreground">Male</p>
              <p className="text-2xl font-semibold">
                {pct(guests.filter((g) => g.gender === "male").length)}
              </p>
            </div>
            <div className={card}>
              <p className="text-xs text-muted-foreground">Checked in</p>
              <p className="text-2xl font-semibold">{checkedIn}</p>
              <p className="text-xs text-muted-foreground">of {total}</p>
            </div>
          </div>

          <div className={card}>
            <p className="mb-3 text-sm font-semibold">Guests by house</p>
            {houseCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No guests yet.</p>
            ) : (
              <ul className="space-y-2">
                {houseCounts.map(([house, n]) => (
                  <li key={house} className="text-sm">
                    <div className="flex justify-between">
                      <span>{house}</span>
                      <span className="text-muted-foreground">
                        {n} · {pct(n)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-border">
                      <div
                        className="h-1.5 rounded-full bg-acacia-gold"
                        style={{ width: `${(n / houseCounts[0][1]) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="space-y-4">
          {canAdd ? (
            <div className={card}>
              <p className="mb-3 text-sm font-semibold">Add a guest</p>
              <GuestForm
                eventId={event.id}
                previous={previous}
                referrals={referrals}
                myId={user!.id}
                existing={existing}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              The list is closed, so brothers can&apos;t add guests anymore.
            </p>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold">
              On the list ({total})
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody yet.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((g) => (
                  <GuestRow
                    key={g.id}
                    guest={g}
                    eventId={event.id}
                    door={false}
                    canCheckIn={false}
                    previous={previous}
                    referrals={referrals}
                    myId={user!.id}
                    existing={existing}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {view === "door" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {checkedIn} of {total} checked in. Not on the list? Add them on the List tab
            {canManage ? "" : " (if it’s still open)"} and they&apos;ll appear here.
          </p>
          <GuestDoorList
            rows={rows}
            eventId={event.id}
            previous={previous}
            referrals={referrals}
            myId={user!.id}
          />
        </div>
      )}
    </div>
  );
}
