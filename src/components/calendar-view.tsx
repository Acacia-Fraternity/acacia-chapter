"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckInButton } from "@/components/check-in-button";
import { eventStatus } from "@/lib/event-status";
import { deleteEvent } from "@/app/dashboard/calendar/actions";
import { categoryLabel, categoryBadgeClass } from "@/lib/event-category";
import type { Event } from "@/lib/types";

type View = "day" | "week" | "month";

const VIEWS: { id: View; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PX_PER_HOUR = 48;
const MS_DAY = 24 * 60 * 60 * 1000;
// Anything this long (e.g. the pledge period) goes in the all-day strip as a
// bar across the days it spans, instead of a giant block in the time grid.
const MULTI_DAY_MS = MS_DAY;

const BLOCK_CLASS: Record<Event["category"], string> = {
  chapter_meeting: "border-acacia-blue bg-acacia-blue/25",
  social: "border-acacia-gold bg-acacia-gold/30",
  philanthropy: "border-acacia-green bg-acacia-green/25",
  party: "border-purple-500 bg-purple-500/25",
  general_social: "border-orange-400 bg-orange-400/25",
  other: "border-muted-foreground bg-surface-border",
};

const STRIP_CLASS: Record<Event["category"], string> = {
  chapter_meeting: "bg-acacia-blue text-white",
  social: "bg-acacia-gold text-acacia-black",
  philanthropy: "bg-acacia-green text-white",
  party: "bg-purple-600 text-white",
  general_social: "bg-orange-500 text-white",
  other: "bg-muted-foreground text-white",
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function startOfWeek(d: Date) {
  return addDays(startOfDay(d), -d.getDay());
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtHour(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

interface Segment {
  event: Event;
  start: Date;
  end: Date;
  col: number;
  cols: number;
}

// Side-by-side columns for events that overlap in time, same idea as
// Outlook/Bridge: events that touch form a cluster, and each cluster is
// split into as many columns as it needs at its busiest moment.
function layoutDay(day: Date, events: Event[]): Segment[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + MS_DAY;

  const segs: Segment[] = events
    .filter((e) => new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime() < MULTI_DAY_MS)
    .map((event) => ({
      event,
      start: new Date(Math.max(new Date(event.starts_at).getTime(), dayStart)),
      end: new Date(Math.min(new Date(event.ends_at).getTime(), dayEnd)),
      col: 0,
      cols: 1,
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());

  const out: Segment[] = [];
  let cluster: Segment[] = [];
  let clusterEnd = 0;

  const flush = () => {
    const columns: Segment[][] = [];
    for (const seg of cluster) {
      const spot = columns.findIndex(
        (c) => c[c.length - 1].end.getTime() <= seg.start.getTime(),
      );
      if (spot === -1) {
        seg.col = columns.length;
        columns.push([seg]);
      } else {
        seg.col = spot;
        columns[spot].push(seg);
      }
    }
    cluster.forEach((s) => (s.cols = columns.length));
    out.push(...cluster);
    cluster = [];
  };

  for (const seg of segs) {
    if (cluster.length && seg.start.getTime() >= clusterEnd) flush();
    cluster.push(seg);
    clusterEnd = Math.max(clusterEnd, seg.end.getTime());
  }
  if (cluster.length) flush();
  return out;
}

export function CalendarView({
  events,
  checkedInEventIds,
  canEdit,
}: {
  events: Event[];
  checkedInEventIds: string[];
  canEdit: boolean;
}) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkedInSet = useMemo(() => new Set(checkedInEventIds), [checkedInEventIds]);
  const selected = events.find((e) => e.id === selectedId) ?? null;

  // A seven-column grid is mostly whitespace plus a scrollbar on a phone,
  // where a single-day column shows real content immediately. Checked once
  // after mount (not during render) so the server and client HTML match.
  useEffect(() => {
    if (window.innerWidth < 640) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView("day");
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => {
    if (view === "day") return [cursor];
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, cursor]);

  // Open the time grid scrolled to the first event of the visible range
  // (or 8 AM), rather than midnight.
  useEffect(() => {
    if (view === "month" || !scrollRef.current) return;
    const rangeStart = days[0].getTime();
    const rangeEnd = days[days.length - 1].getTime() + MS_DAY;
    const hours = events
      .filter((e) => {
        const s = new Date(e.starts_at).getTime();
        return s >= rangeStart && s < rangeEnd;
      })
      .map((e) => new Date(e.starts_at).getHours());
    const first = hours.length ? Math.min(...hours) : 8;
    scrollRef.current.scrollTop = Math.max(0, first * PX_PER_HOUR - 8);
  }, [view, days, events]);

  function step(direction: -1 | 1) {
    if (view === "month") {
      setCursor((c) => new Date(c.getFullYear(), c.getMonth() + direction, 1));
    } else {
      setCursor((c) => addDays(c, direction * (view === "day" ? 1 : 7)));
    }
  }

  function title() {
    if (view === "day") {
      return cursor.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    if (view === "month") {
      return cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    const first = days[0];
    const last = days[6];
    const md = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const lastText =
      first.getMonth() === last.getMonth() ? String(last.getDate()) : md(last);
    return `${md(first)} – ${lastText}, ${last.getFullYear()}`;
  }

  function eventsTouching(day: Date) {
    const s = startOfDay(day).getTime();
    return events.filter(
      (e) => new Date(e.starts_at).getTime() < s + MS_DAY && new Date(e.ends_at).getTime() > s,
    );
  }

  // Multi-day events as bars across the visible days, stacked into rows.
  const strip = useMemo(() => {
    const rangeStart = days[0].getTime();
    const rangeEnd = days[days.length - 1].getTime() + MS_DAY;
    const spanning = events
      .filter((e) => {
        const s = new Date(e.starts_at).getTime();
        const en = new Date(e.ends_at).getTime();
        return en - s >= MULTI_DAY_MS && s < rangeEnd && en > rangeStart;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const rows: number[] = [];
    return spanning.map((event) => {
      const startCol = Math.max(
        0,
        Math.floor((new Date(event.starts_at).getTime() - rangeStart) / MS_DAY),
      );
      const endCol = Math.min(
        days.length - 1,
        Math.floor((new Date(event.ends_at).getTime() - 1 - rangeStart) / MS_DAY),
      );
      let row = rows.findIndex((lastEnd) => lastEnd < startCol);
      if (row === -1) {
        row = rows.length;
        rows.push(endCol);
      } else {
        rows[row] = endCol;
      }
      return { event, startCol, endCol, row };
    });
  }, [days, events]);

  const stripRows = strip.reduce((m, s) => Math.max(m, s.row + 1), 0);
  const gridCols = view === "day" ? "3.5rem 1fr" : "3.5rem repeat(7, minmax(0, 1fr))";

  return (
    <div data-wide className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Calendar</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex rounded-md border border-surface-border overflow-hidden">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setView(v.id);
                  if (v.id === "month") setCursor((c) => new Date(c.getFullYear(), c.getMonth(), 1));
                }}
                className={`px-3 py-1 ${
                  view === v.id ? "bg-acacia-gold text-acacia-black font-semibold" : ""
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {canEdit && (
            <Link
              href="/dashboard/calendar/new"
              className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1 font-semibold"
            >
              + New event
            </Link>
          )}
          <button
            onClick={() => setCursor(startOfDay(new Date()))}
            className="rounded-md border border-surface-border px-3 py-1"
          >
            Today
          </button>
          <button
            onClick={() => step(-1)}
            className="rounded-md border border-surface-border px-2 py-1"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            onClick={() => step(1)}
            className="rounded-md border border-surface-border px-2 py-1"
            aria-label="Next"
          >
            ›
          </button>
        </div>
      </div>

      <p className="text-sm font-medium">{title()}</p>

      {view === "month" ? (
        <MonthGrid
          cursor={cursor}
          events={events}
          now={now}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onOpenDay={(d) => {
            setCursor(startOfDay(d));
            setView("day");
          }}
        />
      ) : (
        <div className="rounded-lg border border-surface-border overflow-x-auto">
          <div
            ref={scrollRef}
            className="h-[calc(100vh-12rem)] min-h-[24rem] overflow-y-auto"
            style={{ minWidth: view === "week" ? 720 : undefined }}
          >
            <div className="sticky top-0 z-20 bg-background border-b border-surface-border">
              <div className="grid" style={{ gridTemplateColumns: gridCols }}>
                <div />
                {days.map((day) => {
                  const isToday = sameDay(day, now);
                  return (
                    <div
                      key={day.toISOString()}
                      className="py-1.5 text-center border-l border-surface-border"
                    >
                      <div className="text-xs text-muted-foreground">
                        {WEEKDAYS[day.getDay()]}
                      </div>
                      <div
                        className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                          isToday ? "bg-acacia-gold text-acacia-black font-semibold" : ""
                        }`}
                      >
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {stripRows > 0 && (
                <div
                  className="grid pb-1"
                  style={{ gridTemplateColumns: gridCols, rowGap: 2 }}
                >
                  <div className="row-span-full text-[10px] text-muted-foreground px-1 pt-1">
                    all day
                  </div>
                  {strip.map(({ event, startCol, endCol, row }) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedId(event.id)}
                      title={event.name}
                      className={`mx-0.5 truncate rounded px-1.5 py-0.5 text-left text-xs font-medium ${STRIP_CLASS[event.category]}`}
                      style={{
                        gridColumn: `${startCol + 2} / ${endCol + 3}`,
                        gridRow: row + 1,
                      }}
                    >
                      {event.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              className="grid relative"
              style={{ gridTemplateColumns: gridCols, height: 24 * PX_PER_HOUR }}
            >
              <div className="relative">
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground"
                    style={{ top: h * PX_PER_HOUR }}
                  >
                    {h === 0 ? "" : fmtHour(h)}
                  </div>
                ))}
              </div>

              {days.map((day) => {
                const segs = layoutDay(day, eventsTouching(day));
                const isToday = sameDay(day, now);
                const nowTop =
                  ((now.getHours() * 60 + now.getMinutes()) / 60) * PX_PER_HOUR;

                return (
                  <div
                    key={day.toISOString()}
                    className="relative border-l border-surface-border"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-surface-border/60"
                        style={{ top: h * PX_PER_HOUR }}
                      />
                    ))}

                    {segs.map((seg) => {
                      const top =
                        ((seg.start.getHours() * 60 + seg.start.getMinutes()) / 60) * PX_PER_HOUR;
                      const height = Math.max(
                        20,
                        ((seg.end.getTime() - seg.start.getTime()) / 3_600_000) * PX_PER_HOUR - 2,
                      );
                      const widthPct = 100 / seg.cols;
                      const roomy = height >= 44;

                      return (
                        <button
                          key={seg.event.id + seg.start.getTime()}
                          onClick={() => setSelectedId(seg.event.id)}
                          title={seg.event.name}
                          className={`absolute overflow-hidden rounded border-l-4 px-1.5 py-0.5 text-left text-xs leading-tight ${BLOCK_CLASS[seg.event.category]} ${
                            seg.event.id === selectedId ? "ring-2 ring-acacia-gold" : ""
                          }`}
                          style={{
                            top,
                            height,
                            left: `calc(${seg.col * widthPct}% + 1px)`,
                            width: `calc(${widthPct}% - 3px)`,
                          }}
                        >
                          <span className="block truncate font-semibold">{seg.event.name}</span>
                          <span className="block truncate text-muted">
                            {fmtTime(new Date(seg.event.starts_at))} –{" "}
                            {fmtTime(new Date(seg.event.ends_at))}
                          </span>
                          {roomy && seg.event.address && (
                            <span className="block truncate text-muted">{seg.event.address}</span>
                          )}
                        </button>
                      );
                    })}

                    {isToday && (
                      <div
                        className="absolute inset-x-0 z-10 flex items-center pointer-events-none"
                        style={{ top: nowTop }}
                      >
                        <span className="h-2 w-2 -ml-1 rounded-full bg-red-500" />
                        <span className="h-px flex-1 bg-red-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <EventDetail
          event={selected}
          checkedIn={checkedInSet.has(selected.id)}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function MonthGrid({
  cursor,
  events,
  now,
  selectedId,
  onSelect,
  onOpenDay,
}: {
  cursor: Date;
  events: Event[];
  now: Date;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDay: (d: Date) => void;
}) {
  const gridStart = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  function onDay(day: Date) {
    const s = day.getTime();
    return events
      .filter(
        (e) => new Date(e.starts_at).getTime() < s + MS_DAY && new Date(e.ends_at).getTime() > s,
      )
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  return (
    <div className="rounded-lg border border-surface-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-surface-border text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const dayEvents = onDay(day);
          const isToday = sameDay(day, now);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-24 border-b border-l border-surface-border p-1 ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <button
                onClick={() => onOpenDay(day)}
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? "bg-acacia-gold text-acacia-black font-semibold" : ""
                }`}
              >
                {day.getDate()}
              </button>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onSelect(e.id)}
                    title={e.name}
                    className={`block w-full truncate rounded border-l-2 px-1 text-left text-[11px] leading-snug ${
                      BLOCK_CLASS[e.category]
                    } ${e.id === selectedId ? "ring-1 ring-acacia-gold" : ""}`}
                  >
                    {sameDay(new Date(e.starts_at), day) && (
                      <span className="text-muted">{fmtTime(new Date(e.starts_at))} </span>
                    )}
                    {e.name}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <button
                    onClick={() => onOpenDay(day)}
                    className="text-[11px] text-muted-foreground"
                  >
                    +{dayEvents.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventDetail({
  event,
  checkedIn,
  canEdit,
  onClose,
}: {
  event: Event;
  checkedIn: boolean;
  canEdit: boolean;
  onClose: () => void;
}) {
  const status = eventStatus(event);
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const multiDay = !sameDay(start, end);

  return (
    <div className="rounded-lg border border-surface-border p-4 flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{event.name}</h2>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground underline"
            aria-label="Close details"
          >
            close
          </button>
        </div>
        {event.description && <p className="text-sm text-muted">{event.description}</p>}
        <p className="text-sm text-muted">
          {multiDay
            ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${fmtTime(start)} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${fmtTime(end)}`
            : `${start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · ${fmtTime(start)} – ${fmtTime(end)}`}
        </p>
        {event.address && <p className="text-sm text-muted">{event.address}</p>}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(event.category)}`}
          >
            {categoryLabel(event.category)}
          </span>
          {event.house_points > 0 ? (
            <span className="inline-block rounded-full bg-acacia-gold text-acacia-black px-2 py-0.5 text-xs font-medium">
              {event.house_points} house point{event.house_points === 1 ? "" : "s"}
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
        <div className="flex items-center gap-4 pt-1">
          <Link
            href="/dashboard/events"
            className="text-sm text-acacia-green underline underline-offset-2"
          >
            RSVP, files &amp; feedback
          </Link>
          {canEdit && (
            <form
              action={deleteEvent.bind(null, event.id)}
              onSubmit={(e) => {
                if (!confirm(`Delete "${event.name}"? This also removes its check-ins, RSVPs and files.`)) {
                  e.preventDefault();
                }
              }}
            >
              <button className="text-sm text-red-600 underline underline-offset-2">
                Delete event
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="shrink-0">
        {checkedIn ? (
          <span className="text-sm text-acacia-green font-medium">✓ Checked in</span>
        ) : status === "open" ? (
          <CheckInButton eventId={event.id} />
        ) : (
          <span className="text-sm text-muted-foreground">
            {status === "upcoming" ? "Not open yet" : "Closed"}
          </span>
        )}
      </div>
    </div>
  );
}
