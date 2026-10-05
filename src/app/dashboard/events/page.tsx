import { createClient } from "@/lib/supabase/server";
import { formatChapterTime } from "@/lib/chapter-time";
import { CheckInButton } from "@/components/check-in-button";
import { CheckOutButton } from "@/components/check-out-button";
import { eventStatus } from "@/lib/event-status";
import { categoryLabel, categoryBadgeClass } from "@/lib/event-category";
import {
  setRsvp,
  submitExcuse,
  withdrawExcuse,
  reviewExcuse,
  submitFeedback,
  uploadEventFile,
  deleteEventFile,
} from "./actions";
import type {
  Event,
  Checkin,
  EventFile,
  EventRsvp,
  EventExcuse,
  EventFeedback,
  EventPresence,
  EventSoberBrother,
  Profile,
  RsvpStatus,
} from "@/lib/types";

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Can't go" },
];

const inputClass =
  "w-full rounded-md border border-surface-border px-3 py-2 text-sm";
const goldButton =
  "rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold";

// Server-rendered, so times must be pinned to the chapter's zone (the
// server itself runs in UTC).
function formatWindow(startIso: string, endIso: string) {
  const day = formatChapterTime(startIso, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = (iso: string) =>
    formatChapterTime(iso, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time(startIso)} – ${time(endIso)}`;
}

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: profiles },
    { data: events },
    { data: myCheckins },
    { data: files },
    { data: rsvps },
    { data: excuses },
    { data: feedback },
    { data: presence },
    { data: sober },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("profiles").select("id, full_name"),
    supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: false })
      .returns<Event[]>(),
    supabase
      .from("checkins")
      .select("*")
      .eq("user_id", user!.id)
      .returns<Checkin[]>(),
    supabase.from("event_files").select("*").returns<EventFile[]>(),
    supabase.from("event_rsvps").select("*").returns<EventRsvp[]>(),
    supabase.from("event_excuses").select("*").returns<EventExcuse[]>(),
    supabase.from("event_feedback").select("*").returns<EventFeedback[]>(),
    supabase
      .from("event_presence")
      .select("*")
      .eq("user_id", user!.id)
      .returns<EventPresence[]>(),
    supabase.from("event_sober_brothers").select("*").returns<EventSoberBrother[]>(),
  ]);

  const isAdmin = profile?.role === "admin";
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const minutesByEvent = new Map(
    (presence ?? []).map((p) => [p.event_id, Math.floor(Number(p.minutes_on_site))]),
  );
  const checkinByEvent = new Map((myCheckins ?? []).map((c) => [c.event_id, c]));
  const totalHours = (myCheckins ?? []).reduce(
    (sum, c) => sum + Number(c.hours_earned),
    0,
  );

  const fileLinks = await Promise.all(
    (files ?? []).map(async (file) => {
      const { data } = await supabase.storage
        .from("chapter-files")
        .createSignedUrl(file.storage_path, 300);
      return [file.id, data?.signedUrl ?? null] as const;
    }),
  );
  const urlByFileId = new Map(fileLinks);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Events</h1>
        {totalHours > 0 && (
          <span className="text-sm text-acacia-green font-medium">
            {totalHours} hour{totalHours === 1 ? "" : "s"} earned
          </span>
        )}
      </div>

      {(!events || events.length === 0) && (
        <p className="text-sm text-muted">No events yet.</p>
      )}

      <ul className="space-y-4">
        {events?.map((event) => {
          const status = eventStatus(event);
          const checkin = checkinByEvent.get(event.id);
          const eventFiles = (files ?? []).filter((f) => f.event_id === event.id);
          const eventRsvps = (rsvps ?? []).filter((r) => r.event_id === event.id);
          const myRsvp = eventRsvps.find((r) => r.user_id === user!.id);
          const myExcuse = (excuses ?? []).find(
            (x) => x.event_id === event.id && x.user_id === user!.id,
          );
          const eventFeedback = (feedback ?? []).filter(
            (f) => f.event_id === event.id,
          );
          const myFeedback = eventFeedback.find((f) => f.user_id === user!.id);
          const goingCount = eventRsvps.filter((r) => r.status === "going").length;
          const avgRating = eventFeedback.length
            ? eventFeedback.reduce((s, f) => s + f.rating, 0) / eventFeedback.length
            : null;
          const pendingExcuses = (excuses ?? []).filter(
            (x) => x.event_id === event.id && x.status === "pending",
          );
          const soberNames = (sober ?? [])
            .filter((b) => b.event_id === event.id)
            .map((b) => nameById.get(b.user_id) ?? "Unknown");
          const minutesOnSite = minutesByEvent.get(event.id) ?? 0;
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${
            event.address
              ? encodeURIComponent(event.address)
              : `${event.latitude},${event.longitude}`
          }`;

          return (
            <li
              key={event.id}
              className="rounded-xl border border-surface-border overflow-hidden"
            >
              <div className="h-1.5 bg-acacia-gold" />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-base">{event.name}</h2>
                    <p className="text-sm text-muted">
                      {formatWindow(event.starts_at, event.ends_at)}
                    </p>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-acacia-green underline underline-offset-2"
                    >
                      {event.address || "View on map"}
                    </a>
                  </div>

                  <div className="shrink-0 space-y-2 text-right">
                    {checkin && !checkin.checked_out_at && status !== "upcoming" ? (
                      <>
                        <p className="text-sm text-acacia-green font-medium">
                          ✓ Checked in
                        </p>
                        {event.category === "philanthropy" && (
                          <p className="text-xs text-muted-foreground max-w-48 ml-auto">
                            Check out before you leave — you have to be at the
                            location, and your hours are the time you spent.
                          </p>
                        )}
                        <CheckOutButton eventId={event.id} />
                      </>
                    ) : checkin ? (
                      <p className="text-sm text-acacia-green font-medium">
                        ✓ Attended
                        {event.category === "philanthropy" && (
                          <span className="block text-xs font-normal">
                            {Number(checkin.hours_earned)} hr
                            {Number(checkin.hours_earned) === 1 ? "" : "s"} earned
                          </span>
                        )}
                        {checkin.checked_out_at && (
                          <span className="block text-xs text-muted-foreground font-normal">
                            out{" "}
                            {formatChapterTime(checkin.checked_out_at, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </p>
                    ) : status === "open" ? (
                      <CheckInButton eventId={event.id} />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {status === "upcoming" ? "Not open yet" : "Closed"}
                      </span>
                    )}
                  </div>
                </div>

                {soberNames.length > 0 && (
                  <p className="text-sm">
                    <span className="font-medium">Sober brothers:</span>{" "}
                    <span className="text-muted">{soberNames.join(", ")}</span>
                  </p>
                )}

                {minutesOnSite > 0 && (
                  <p className="text-xs text-acacia-green">
                    {minutesOnSite} min on site
                    {event.category === "philanthropy" &&
                      ` · ${Math.floor(minutesOnSite / 60)} house point${
                        Math.floor(minutesOnSite / 60) === 1 ? "" : "s"
                      } earned (1 per full hour)`}
                  </p>
                )}

                {event.description && (
                  <p className="text-sm text-muted">{event.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      status === "open"
                        ? "bg-acacia-green/15 text-acacia-green"
                        : "bg-surface-border text-muted"
                    }`}
                  >
                    {status}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(event.category)}`}
                  >
                    {categoryLabel(event.category)}
                  </span>
                  {event.house_points > 0 ? (
                    <span className="inline-block rounded-full bg-acacia-gold text-acacia-black px-2 py-0.5 text-xs font-medium">
                      {event.house_points} house point
                      {event.house_points === 1 ? "" : "s"}
                    </span>
                  ) : event.category === "philanthropy" ? (
                    <span className="inline-block rounded-full bg-acacia-gold text-acacia-black px-2 py-0.5 text-xs font-medium">
                      1 house point / hour
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-surface-border text-muted-foreground px-2 py-0.5 text-xs font-medium">
                      No house points
                    </span>
                  )}
                  {event.hours > 0 && (
                    <span className="inline-block rounded-full bg-acacia-green/15 text-acacia-green px-2 py-0.5 text-xs font-medium">
                      {event.hours} service hr{event.hours === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {status !== "closed" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {RSVP_OPTIONS.map((opt) => (
                      <form
                        key={opt.value}
                        action={setRsvp.bind(null, event.id, opt.value)}
                      >
                        <button
                          type="submit"
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            myRsvp?.status === opt.value
                              ? "border-acacia-gold bg-acacia-gold/25"
                              : "border-surface-border"
                          }`}
                        >
                          {opt.label}
                        </button>
                      </form>
                    ))}
                    <span className="text-xs text-muted-foreground">
                      {goingCount} going
                    </span>
                  </div>
                )}

                {status !== "closed" && !checkin && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted">
                      {myExcuse
                        ? `Excuse ${myExcuse.status}`
                        : "Can't make it? Submit an excuse"}
                    </summary>
                    {myExcuse ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted">{myExcuse.reason}</p>
                        {myExcuse.status === "pending" && (
                          <form
                            action={withdrawExcuse.bind(null, event.id, user!.id)}
                          >
                            <button className="text-xs underline text-muted-foreground">
                              Withdraw
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <form
                        action={submitExcuse.bind(null, event.id)}
                        className="mt-2 space-y-2"
                      >
                        <textarea
                          name="reason"
                          rows={2}
                          required
                          placeholder="Reason (class, work, sick…)"
                          className={inputClass}
                        />
                        <button type="submit" className={goldButton}>
                          Submit excuse
                        </button>
                      </form>
                    )}
                  </details>
                )}

                {(eventFiles.length > 0 || isAdmin) && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted">
                      Files &amp; docs ({eventFiles.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {eventFiles.map((file) => {
                        const url = urlByFileId.get(file.id);
                        return (
                          <li
                            key={file.id}
                            className="flex items-center justify-between gap-2"
                          >
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-acacia-green underline underline-offset-2"
                              >
                                {file.title}
                              </a>
                            ) : (
                              <span>{file.title}</span>
                            )}
                            {isAdmin && (
                              <form
                                action={deleteEventFile.bind(
                                  null,
                                  file.id,
                                  file.storage_path,
                                )}
                              >
                                <button className="text-xs text-red-600">
                                  Delete
                                </button>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {isAdmin && (
                      <form
                        action={uploadEventFile.bind(null, event.id)}
                        className="mt-2 flex flex-wrap gap-2"
                      >
                        <input
                          name="title"
                          placeholder="Title (optional)"
                          className="rounded-md border border-surface-border px-2 py-1 text-sm"
                        />
                        <input name="file" type="file" required className="text-xs" />
                        <button type="submit" className={goldButton}>
                          Upload
                        </button>
                      </form>
                    )}
                  </details>
                )}

                {status !== "upcoming" && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted">
                      {myFeedback ? "Your feedback (edit)" : "Leave feedback"}
                    </summary>
                    <form
                      action={submitFeedback.bind(null, event.id)}
                      className="mt-2 space-y-2"
                    >
                      <select
                        name="rating"
                        defaultValue={myFeedback?.rating ?? 5}
                        className={inputClass}
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {"★".repeat(n)} ({n})
                          </option>
                        ))}
                      </select>
                      <textarea
                        name="comments"
                        rows={2}
                        defaultValue={myFeedback?.comments ?? ""}
                        placeholder="What worked, what didn't?"
                        className={inputClass}
                      />
                      <button type="submit" className={goldButton}>
                        Send feedback
                      </button>
                    </form>
                  </details>
                )}

                {isAdmin && (
                  <details className="text-sm border-t border-surface-border pt-2">
                    <summary className="cursor-pointer text-muted">
                      Admin: {pendingExcuses.length} pending excuse
                      {pendingExcuses.length === 1 ? "" : "s"} ·{" "}
                      {eventFeedback.length} feedback
                      {avgRating !== null && ` (avg ${avgRating.toFixed(1)}★)`}
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {pendingExcuses.map((x) => (
                        <li key={x.user_id} className="space-y-1">
                          <p>
                            <span className="font-medium">
                              {nameById.get(x.user_id) ?? "Unknown"}
                            </span>
                            : {x.reason}
                          </p>
                          <div className="flex gap-2">
                            <form
                              action={reviewExcuse.bind(
                                null,
                                event.id,
                                x.user_id,
                                "approved",
                              )}
                            >
                              <button className="text-xs text-acacia-green underline">
                                Approve
                              </button>
                            </form>
                            <form
                              action={reviewExcuse.bind(
                                null,
                                event.id,
                                x.user_id,
                                "denied",
                              )}
                            >
                              <button className="text-xs text-red-600 underline">
                                Deny
                              </button>
                            </form>
                          </div>
                        </li>
                      ))}
                      {eventFeedback.map((f) => (
                        <li key={f.user_id} className="text-xs text-muted">
                          {"★".repeat(f.rating)}{" "}
                          {f.comments && `— ${f.comments}`}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
