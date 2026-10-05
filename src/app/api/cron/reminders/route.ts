import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAPTER_TZ } from "@/lib/chapter-time";
import { chapterToday, daysUntil, formatMoney } from "@/lib/dues";
import { recordCanvasError, syncCanvasGrades } from "@/lib/canvas";

// Called every ~5 minutes by .github/workflows/reminders.yml. Sends a push
// for each (member, event, lead time) that is due and hasn't been sent.
// "Due" means now is past (start - lead) and the event hasn't started — so
// a late or skipped scheduler run still sends, just closer to the start.

const LEADS = [
  { minutes: 15, column: "remind_15m" },
  { minutes: 60, column: "remind_1h" },
  { minutes: 1440, column: "remind_1d" },
] as const;

interface Prefs {
  user_id: string;
  remind_15m: boolean;
  remind_1h: boolean;
  remind_1d: boolean;
  push_subscriptions: webpush.PushSubscription[];
}

function untilText(minutes: number): string {
  if (minutes >= 90) return `in about ${Math.round(minutes / 60)} hours`;
  if (minutes >= 60) return "in about an hour";
  if (minutes <= 1) return "now";
  return `in ${Math.round(minutes)} minutes`;
}

async function pushToAll(
  admin: SupabaseClient,
  pref: Prefs,
  payload: string,
): Promise<number> {
  let sent = 0;
  const alive: webpush.PushSubscription[] = [];
  for (const sub of pref.push_subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      alive.push(sub);
      sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410: the browser dropped this subscription — stop trying it.
      if (status !== 404 && status !== 410) alive.push(sub);
    }
  }
  if (alive.length !== pref.push_subscriptions.length) {
    await admin
      .from("notification_prefs")
      .update({ push_subscriptions: alive })
      .eq("user_id", pref.user_id);
  }
  return sent;
}

// A reminder "stage" is how far the due date is: a week out, the day before,
// the day itself, then weekly while overdue. Only the current stage is sent,
// and the log makes each stage fire once per charge.
function duesStage(days: number): string | null {
  if (days < 0) return `late_${Math.floor((-days - 1) / 7)}`;
  if (days === 0) return "due";
  if (days <= 1) return "d1";
  if (days <= 7) return "d7";
  return null;
}

function duesBody(title: string, amount: number, days: number): string {
  const money = formatMoney(amount);
  if (days < 0) return `${title} (${money}) is ${-days} day${days === -1 ? "" : "s"} overdue.`;
  if (days === 0) return `${title} (${money}) is due today.`;
  return `${title} (${money}) is due in ${days} day${days === 1 ? "" : "s"}.`;
}

async function sendDuesReminders(admin: SupabaseClient, prefs: Prefs[]): Promise<number> {
  // Don't buzz anyone's phone overnight.
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: CHAPTER_TZ, hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
  if (hour < 9 || hour >= 20) return 0;

  const { data: charges } = await admin
    .from("dues_charges")
    .select("id, user_id, title, amount_cents, due_date")
    .is("paid_at", null);
  if (!charges?.length) return 0;

  const prefByUser = new Map(prefs.map((p) => [p.user_id, p]));
  const today = chapterToday();
  let sent = 0;

  for (const charge of charges) {
    const pref = prefByUser.get(charge.user_id);
    if (!pref) continue;
    const days = daysUntil(charge.due_date, today);
    const stage = duesStage(days);
    if (!stage) continue;

    const { error } = await admin.from("dues_reminder_log").insert({ charge_id: charge.id, stage });
    if (error) {
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }

    sent += await pushToAll(
      admin,
      pref,
      JSON.stringify({
        title: "Dues reminder",
        body: duesBody(charge.title, charge.amount_cents, days),
        url: "/dashboard/dues",
      }),
    );
  }
  return sent;
}

// Keeps pledges' Canvas grades reasonably fresh without hammering Canvas:
// a few connections per run, only those not synced in the last 6 hours.
async function refreshStaleCanvas(admin: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data } = await admin
    .from("canvas_connections")
    .select("user_id, access_token")
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .limit(5);
  for (const c of data ?? []) {
    try {
      await syncCanvasGrades(admin, c.user_id, c.access_token);
    } catch (err) {
      await recordCanvasError(admin, c.user_id, err instanceof Error ? err.message : "Sync failed");
      // Push last_synced_at forward so a dead token isn't retried every run.
      await admin
        .from("canvas_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", c.user_id);
    }
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }
  webpush.setVapidDetails("mailto:acacia-chapter@users.noreply.github.com", publicKey, privateKey);

  const admin = createAdminClient();
  const now = Date.now();
  const horizon = new Date(now + 1440 * 60_000).toISOString();

  const [{ data: events }, { data: allPrefs }] = await Promise.all([
    admin
      .from("events")
      .select("id, name, starts_at")
      .gt("starts_at", new Date(now).toISOString())
      .lte("starts_at", horizon),
    admin.from("notification_prefs").select("*").returns<Prefs[]>(),
  ]);

  const prefs = (allPrefs ?? []).filter((p) => p.push_subscriptions.length > 0);

  let sent = 0;
  if (prefs.length > 0) sent += await sendDuesReminders(admin, prefs);
  await refreshStaleCanvas(admin);
  if (!events?.length || prefs.length === 0) return NextResponse.json({ sent });

  const eventIds = events.map((e) => e.id);
  const { data: declined } = await admin
    .from("event_rsvps")
    .select("event_id, user_id")
    .in("event_id", eventIds)
    .eq("status", "not_going");
  const declinedKeys = new Set((declined ?? []).map((r) => `${r.event_id}:${r.user_id}`));

  for (const event of events) {
    const minutesUntil = (new Date(event.starts_at).getTime() - now) / 60_000;

    for (const pref of prefs) {
      if (declinedKeys.has(`${event.id}:${pref.user_id}`)) continue;

      // Several leads can be due at once (e.g. the scheduler was down) —
      // only the nearest one is worth a notification, but all are logged so
      // the earlier ones don't fire afterwards.
      const due = LEADS.filter((l) => pref[l.column] && minutesUntil <= l.minutes);
      if (due.length === 0) continue;

      let claimedAny = false;
      for (const lead of due) {
        const { error } = await admin.from("reminder_log").insert({
          event_id: event.id,
          user_id: pref.user_id,
          lead_minutes: lead.minutes,
        });
        // 23505 = already sent on an earlier run.
        if (!error) claimedAny = true;
        else if (error.code !== "23505") throw new Error(error.message);
      }
      if (!claimedAny) continue;

      const payload = JSON.stringify({
        title: event.name,
        body: `Starts ${untilText(minutesUntil)}`,
        url: "/dashboard/events",
      });

      sent += await pushToAll(admin, pref, payload);
    }
  }

  return NextResponse.json({ sent });
}
