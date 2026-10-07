import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LivesInHouseToggle } from "@/components/lives-in-house-toggle";
import { PresenceToggle } from "@/components/presence-toggle";
import { HouseMap, type MapPoint } from "@/components/house-map";
import { HOUSE_LOCATION } from "@/lib/house-location";
import { rotateLocationToken } from "./actions";
import { placeAt } from "@/lib/places";
import { allowedKeys } from "@/lib/permissions";
import type { Profile, HousePresenceSession } from "@/lib/types";

type Filter = "all" | "away" | "pledges";
type Range = "day" | "week";

const RANGE_HOURS: Record<Range, number> = { day: 24, week: 24 * 7 };
const MEMBER_COLORS = [
  "#e11d48", "#2563eb", "#d97706", "#7c3aed", "#0891b2",
  "#65a30d", "#db2777", "#ea580c", "#4f46e5", "#0d9488",
];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "away", label: "Not at the house" },
  { value: "pledges", label: "Pledges" },
];

function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

// PostgREST returns at most 1000 rows per request, so page through.
async function fetchTrail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  range: Range,
) {
  const since = new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString();
  const rows: {
    user_id: string;
    latitude: number;
    longitude: number;
    recorded_at: string;
  }[] = [];
  for (let from = 0; from < 10_000; from += 1000) {
    const { data } = await supabase
      .from("member_locations")
      .select("user_id, latitude, longitude, recorded_at")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .range(from, from + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function timeAgo(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function HousePresencePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; range?: string }>;
}) {
  const { filter: filterParam, range: rangeParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Which subtabs this role may use decides the defaults for range/filter.
  const [{ data: me }, { data: permRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("role_permissions").select("*"),
  ]);
  const allowed = allowedKeys(me!, permRows ?? []);
  const allowedRanges = (["day", "week"] as const).filter((r) => allowed.has(`house_range_${r}`));
  const visibleFilters = FILTERS.filter((f) => allowed.has(`house_filter_${f.value}`));
  const requestedRange: Range = rangeParam === "week" ? "week" : "day";
  const range: Range = allowedRanges.includes(requestedRange)
    ? requestedRange
    : (allowedRanges[0] ?? "day");
  const requestedFilter: Filter =
    filterParam === "away" || filterParam === "pledges" ? filterParam : "all";
  const filter: Filter = visibleFilters.some((f) => f.value === requestedFilter)
    ? requestedFilter
    : (visibleFilters[0]?.value ?? "all");

  const [
    { data: profile },
    { data: members },
    { data: sessions },
    { data: lastSessions },
    { data: token },
    trailRows,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("profiles").select("*").order("full_name").returns<Profile[]>(),
    supabase
      .from("house_presence_sessions")
      .select("*")
      .gte("started_at", startOfWeek().toISOString())
      .returns<HousePresenceSession[]>(),
    // Most recent session per member, regardless of week, for "last seen".
    supabase
      .from("house_presence_sessions")
      .select("*")
      .order("last_ping_at", { ascending: false })
      .limit(500)
      .returns<HousePresenceSession[]>(),
    supabase.rpc("get_or_create_location_token"),
    fetchTrail(supabase, range),
  ]);

  const isAdmin = profile?.role === "admin";
  const seesAll = allowed.has("view_all_locations");
  const now = new Date().getTime();

  const hoursByUserId = new Map<string, number>();
  const currentlyHomeSet = new Set<string>();

  for (const session of sessions ?? []) {
    const start = new Date(session.started_at).getTime();
    const end = session.ended_at ? new Date(session.ended_at).getTime() : now;
    const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
    hoursByUserId.set(session.user_id, (hoursByUserId.get(session.user_id) ?? 0) + hours);
  }

  const lastSeenByUserId = new Map<string, string>();
  for (const session of lastSessions ?? []) {
    if (!session.ended_at) currentlyHomeSet.add(session.user_id);
    if (!lastSeenByUserId.has(session.user_id)) {
      lastSeenByUserId.set(session.user_id, session.ended_at ?? session.last_ping_at);
    }
  }

  const colorById = new Map(
    (members ?? []).map((m, i) => [m.id, MEMBER_COLORS[i % MEMBER_COLORS.length]]),
  );
  const mapMembers = (members ?? []).map((m) => ({
    id: m.id,
    name: m.full_name || "(no name)",
    color: colorById.get(m.id)!,
    isHome: currentlyHomeSet.has(m.id),
  }));
  const mapPoints: MapPoint[] = trailRows.map((r) => ({
    user_id: r.user_id,
    lat: r.latitude,
    lng: r.longitude,
    at: r.recorded_at,
  }));

  // Where each person's newest breadcrumb puts them, if it's recent and inside
  // the house's or a residence hall's vicinity. Only as visible as the trail
  // itself (RLS: own trail, or everyone's with view_all_locations).
  const placeByUserId = new Map<string, string>();
  for (const r of trailRows) {
    if (now - new Date(r.recorded_at).getTime() > 30 * 60_000) continue;
    const place = placeAt(r.latitude, r.longitude);
    if (place) placeByUserId.set(r.user_id, place);
    else placeByUserId.delete(r.user_id);
  }

  const visibleMembers = (members ?? []).filter((m) => {
    if (filter === "away") return !currentlyHomeSet.has(m.id);
    if (filter === "pledges") return m.is_pledge;
    return true;
  });
  const homeCount = (members ?? []).filter((m) => currentlyHomeSet.has(m.id)).length;

  const host = (await headers()).get("host") ?? "your-app-domain";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const endpoint = `${protocol}://${host}/api/location`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">House Presence</h1>
        <p className="text-sm text-muted-foreground">
          {homeCount} of {members?.length ?? 0} at the house right now. Brothers
          who set up always-on tracking below are tracked continuously;
          everyone else is only counted while the app is open near the house
          (use &quot;I&apos;m home&quot;/&quot;I&apos;m leaving&quot; to cover
          the gaps).
        </p>
      </div>

      {allowed.has("house_map") && (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-medium text-muted">
            Where everyone has been{" "}
            {seesAll ? "" : "(you — only certain roles see the whole chapter)"}
          </h2>
          <div className="flex gap-1.5">
            {allowedRanges.map((r) => (
              <Link
                key={r}
                href={`/dashboard/house-presence?range=${r}${filter === "all" ? "" : `&filter=${filter}`}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  range === r ? "border-acacia-gold bg-acacia-gold/25" : "border-surface-border"
                }`}
              >
                {r === "day" ? "Last 24 hours" : "Last 7 days"}
              </Link>
            ))}
          </div>
        </div>
        <HouseMap
          house={HOUSE_LOCATION}
          members={seesAll ? mapMembers : mapMembers.filter((m) => m.id === user!.id)}
          points={mapPoints}
        />
        {mapPoints.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No location points yet in this window. Points appear once someone
            sets up always-on tracking (below) or has the app open.
          </p>
        )}
      </div>

      )}

      {allowed.has("house_roster") && (
        <>
      <div className="flex flex-wrap gap-2">
        {visibleFilters.map((f) => (
          <Link
            key={f.value}
            href={
              f.value === "all"
                ? "/dashboard/house-presence"
                : `/dashboard/house-presence?filter=${f.value}`
            }
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === f.value
                ? "border-acacia-gold bg-acacia-gold/25"
                : "border-surface-border"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {visibleMembers.length === 0 && (
        <p className="text-sm text-muted-foreground">Nobody matches this filter.</p>
      )}

      <ul className="space-y-2">
        {visibleMembers.map((member) => {
          const isSelf = member.id === user!.id;
          const isHome = currentlyHomeSet.has(member.id);
          const hours = hoursByUserId.get(member.id) ?? 0;
          const lastSeen = lastSeenByUserId.get(member.id);

          return (
            <li
              key={member.id}
              className="rounded-lg border border-surface-border p-3 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    isHome ? "bg-acacia-green" : "bg-surface-border"
                  }`}
                  title={isHome ? "Currently home" : "Not at the house"}
                />
                <span className="text-sm font-medium truncate">
                  {member.full_name || "(no name set)"}
                  {isSelf && <span className="text-muted-foreground"> (you)</span>}
                </span>
                {member.is_pledge && (
                  <span className="rounded-full bg-acacia-gold/25 px-2 py-0.5 text-xs font-medium">
                    Pledge
                  </span>
                )}
                {placeByUserId.has(member.id) && (
                  <span className="rounded-full bg-acacia-green/15 px-2 py-0.5 text-xs font-medium">
                    at {placeByUserId.get(member.id)}
                  </span>
                )}
                {!isHome && lastSeen && (
                  <span className="text-xs text-muted-foreground">
                    last at house {timeAgo(lastSeen, now)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <LivesInHouseToggle
                  userId={member.id}
                  livesInHouse={member.lives_in_house}
                  canEdit={isSelf || isAdmin}
                />
                <span className="text-xs text-muted-foreground">
                  {hours.toFixed(1)} hrs this week
                </span>
                {isSelf && <PresenceToggle isCurrentlyHome={isHome} />}
              </div>
            </li>
          );
        })}
      </ul>

        </>
      )}

      {allowed.has("house_tracking_setup") && (
      <details className="rounded-lg border border-surface-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Set up always-on tracking on your phone
        </summary>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Websites can&apos;t see your location once the app is closed, so
            this uses a free tracker app that can. It reports your position to
            the chapter&apos;s server in the background; the server only records
            when you enter or leave the house or an event.
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              Install <span className="font-medium">Traccar Client</span> (free,
              iPhone and Android).
            </li>
            <li>
              Set <span className="font-medium">Device identifier</span> to your
              personal code below.
            </li>
            <li>
              Set <span className="font-medium">Server URL</span> to{" "}
              <code className="break-all">{endpoint}</code>
            </li>
            <li>Set frequency to 60 seconds and turn the service on.</li>
            <li>
              When asked, allow location <span className="font-medium">Always</span>{" "}
              (on iPhone also leave Precise Location on).
            </li>
          </ol>
          <div>
            <p className="text-xs">Your personal code (treat it like a password):</p>
            <code className="block break-all rounded-md bg-surface-border px-2 py-1 text-xs">
              {typeof token === "string" ? token : "unavailable"}
            </code>
          </div>
          <form action={rotateLocationToken}>
            <button className="text-xs underline text-muted-foreground">
              Reset my code (lost phone or leaked it)
            </button>
          </form>
        </div>
      </details>
      )}
    </div>
  );
}
