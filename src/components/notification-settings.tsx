"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LeadKey = "remind_15m" | "remind_1h" | "remind_1d";

const LEADS: { key: LeadKey; label: string }[] = [
  { key: "remind_15m", label: "15 minutes before" },
  { key: "remind_1h", label: "1 hour before" },
  { key: "remind_1d", label: "1 day before" },
];

interface PushSub {
  endpoint: string;
  keys?: Record<string, string>;
}

function base64ToUint8Array(base64: string) {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function NotificationSettings({
  userId,
  initial,
  initialSubscriptions,
  vapidPublicKey,
}: {
  userId: string;
  initial: Record<LeadKey, boolean>;
  initialSubscriptions: PushSub[];
  vapidPublicKey: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [leads, setLeads] = useState(initial);
  const [subs, setSubs] = useState(initialSubscriptions);
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setThisDevice(sub?.endpoint ?? null))
      .catch(() => {});
  }, []);

  async function save(next: Record<LeadKey, boolean>, nextSubs: PushSub[]) {
    const { error } = await supabase.from("notification_prefs").upsert({
      user_id: userId,
      ...next,
      push_subscriptions: nextSubs,
    });
    if (error) throw new Error(error.message);
  }

  async function toggleLead(key: LeadKey, checked: boolean) {
    const next = { ...leads, [key]: checked };
    setLeads(next);
    setError(null);
    try {
      await save(next, subs);
    } catch (err) {
      setLeads(leads);
      setError(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  async function enableThisDevice() {
    setBusy(true);
    setError(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        throw new Error("Notifications are blocked — allow them in your browser settings.");
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON() as PushSub;
      const nextSubs = [...subs.filter((s) => s.endpoint !== json.endpoint), json];
      await save(leads, nextSubs);
      setSubs(nextSubs);
      setThisDevice(json.endpoint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn on notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disableThisDevice() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      const nextSubs = subs.filter((s) => s.endpoint !== thisDevice);
      await save(leads, nextSubs);
      setSubs(nextSubs);
      setThisDevice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn off notifications");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted">Event reminders</h2>

      <div className="space-y-2">
        {LEADS.map((lead) => (
          <label key={lead.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={leads[lead.key]}
              onChange={(e) => toggleLead(lead.key, e.target.checked)}
            />
            {lead.label}
          </label>
        ))}
      </div>

      {!supported ? (
        <p className="text-xs text-muted-foreground">
          This browser can&apos;t receive push notifications. On iPhone, tap
          Share → Add to Home Screen, then open Acacia from the home screen and
          come back here.
        </p>
      ) : thisDevice ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-acacia-green">
            Reminders are on for this device.
          </span>
          <button
            onClick={disableThisDevice}
            disabled={busy}
            className="text-xs underline text-muted-foreground"
          >
            Turn off
          </button>
        </div>
      ) : (
        <button
          onClick={enableThisDevice}
          disabled={busy}
          className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Working…" : "Turn on notifications on this device"}
        </button>
      )}

      <p className="text-xs text-muted-foreground">
        Pick the times above, then turn notifications on for each device you
        want them on. You won&apos;t be reminded about events you RSVP &quot;Can&apos;t
        go&quot; to.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
