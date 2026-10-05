import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Receives pings from an always-on tracker app on a brother's phone. Phones
// give web apps no background location (see house_presence_sessions in
// schema.sql), so the only way to get true 24/7 presence without building a
// native app is an existing one that already holds "Always Allow" location
// and can POST to a URL. Two are supported:
//   - Traccar Client (free, iOS/Android): its "device identifier" is the
//     token. Newer versions post JSON, older ones send query/form params.
//   - OwnTracks (free, iOS/Android): HTTP mode posts JSON
//     {_type:"location", lat, lon, acc, tst}; put ?token=... on its URL.
// The token is a bearer secret tied to one member (location_tokens), so
// this route is public to the middleware and authenticates itself.

const MAX_ACCURACY_METERS = 150;
// Trackers buffer pings while offline and flush them later; a replayed old
// fix must not be recorded as "here right now".
const MAX_AGE_SECONDS = 10 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Fix {
  token: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  timestampSeconds: number | null;
}

// Number(null) is 0, which would turn a missing coordinate into a valid
// "0,0" fix — so absent values must stay absent.
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function readFix(request: NextRequest): Promise<Fix | null> {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  let json: Record<string, unknown> = {};

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    try {
      if (contentType.includes("application/json")) {
        json = await request.json();
      } else {
        const form = new URLSearchParams(await request.text());
        form.forEach((value, key) => params.set(key, value));
      }
    } catch {
      return null;
    }
  }

  // The current Traccar Client app posts JSON shaped like
  // {device_id, location: {timestamp: ISO string, coords: {latitude,
  // longitude, accuracy}}}; older versions and OwnTracks use flat fields.
  const location = (json.location ?? {}) as Record<string, unknown>;
  const coords = (location.coords ?? {}) as Record<string, unknown>;

  const lat = num(json.lat ?? coords.latitude ?? params.get("lat"));
  const lng = num(json.lon ?? coords.longitude ?? params.get("lon"));
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const accuracy = num(json.acc ?? coords.accuracy ?? params.get("accuracy"));

  let timestampSeconds = num(json.tst ?? params.get("timestamp"));
  if (timestampSeconds === null && typeof location.timestamp === "string") {
    const parsed = Date.parse(location.timestamp);
    if (Number.isFinite(parsed)) timestampSeconds = parsed / 1000;
  }
  // Traccar sends epoch seconds, but some versions send milliseconds.
  if (timestampSeconds && timestampSeconds > 1e11) timestampSeconds /= 1000;

  const rawToken = params.get("token") ?? params.get("id") ?? json.device_id ?? json.id;

  return {
    token: typeof rawToken === "string" ? rawToken.trim() : null,
    lat,
    lng,
    accuracy,
    timestampSeconds,
  };
}

// Best-effort audit trail of every attempt (see location_ping_log). Never
// logs a token: UUIDs are masked before anything is stored.
async function logAttempt(
  admin: ReturnType<typeof createAdminClient>,
  outcome: string,
  detail: string,
) {
  try {
    await admin.from("location_ping_log").insert({
      outcome,
      detail: detail.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<uuid>").slice(0, 500),
    });
    // Newest 300 only; the id cutoff avoids a count query per request.
    const { data } = await admin
      .from("location_ping_log")
      .select("id")
      .order("id", { ascending: false })
      .range(300, 300);
    if (data?.[0]) {
      await admin.from("location_ping_log").delete().lte("id", data[0].id);
    }
  } catch {
    // Diagnostics must never break a ping.
  }
}

async function handle(request: NextRequest) {
  const admin = createAdminClient();
  const raw = (await request.clone().text().catch(() => "")).slice(0, 400);
  const describe = () =>
    `${request.method} ${request.headers.get("content-type") ?? "no-content-type"} query=${request.nextUrl.search} body=${raw}`;

  const fix = await readFix(request);
  if (!fix) {
    await logAttempt(admin, "bad-location", describe());
    return NextResponse.json({ error: "Bad location" }, { status: 400 });
  }
  if (!fix.token || !UUID.test(fix.token)) {
    await logAttempt(admin, "bad-token-format", `token=${fix.token}`);
    return NextResponse.json({ error: "Unknown token" }, { status: 401 });
  }

  const { data: owner } = await admin
    .from("location_tokens")
    .select("user_id")
    .eq("token", fix.token)
    .maybeSingle();
  if (!owner) {
    await logAttempt(admin, "unknown-token", "valid format, not in location_tokens");
    return NextResponse.json({ error: "Unknown token" }, { status: 401 });
  }

  // Ignored fixes still return 200 so the tracker app doesn't retry them forever.
  const tooOld =
    fix.timestampSeconds !== null &&
    Date.now() / 1000 - fix.timestampSeconds > MAX_AGE_SECONDS;
  const tooVague = fix.accuracy !== null && fix.accuracy > MAX_ACCURACY_METERS;
  if (tooOld || tooVague) {
    await logAttempt(
      admin,
      tooOld ? "ignored-too-old" : "ignored-low-accuracy",
      `accuracy=${fix.accuracy} ts=${fix.timestampSeconds}`,
    );
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { error } = await admin.rpc("record_presence", {
    p_user: owner.user_id,
    p_lat: fix.lat,
    p_lng: fix.lng,
  });
  if (error) {
    await logAttempt(admin, "db-error", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAttempt(admin, "recorded", `accuracy=${fix.accuracy}`);
  return NextResponse.json({ ok: true });
}

export const GET = handle;
export const POST = handle;
