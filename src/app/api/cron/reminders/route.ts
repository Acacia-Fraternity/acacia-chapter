import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

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
  if (!events?.length || prefs.length === 0) return NextResponse.json({ sent: 0 });

  const eventIds = events.map((e) => e.id);
  const { data: declined } = await admin
    .from("event_rsvps")
    .select("event_id, user_id")
    .in("event_id", eventIds)
    .eq("status", "not_going");
  const declinedKeys = new Set((declined ?? []).map((r) => `${r.event_id}:${r.user_id}`));

  let sent = 0;
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
    }
  }

  return NextResponse.json({ sent });
}
