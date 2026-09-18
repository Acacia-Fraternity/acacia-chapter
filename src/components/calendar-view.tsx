"use client";

import { useMemo, useState } from "react";
import { CheckInButton } from "@/components/check-in-button";
import { eventStatus } from "@/lib/event-status";
import { categoryLabel, categoryBadgeClass } from "@/lib/event-category";
import type { Event } from "@/lib/types";

const CATEGORY_DOT_CLASS: Record<Event["category"], string> = {
  chapter_meeting: "bg-acacia-blue",
  social: "bg-acacia-gold",
  philanthropy: "bg-acacia-green",
  other: "bg-muted-foreground",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function CalendarView({
  events,
  checkedInEventIds,
}: {
  events: Event[];
  checkedInEventIds: string[];
}) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const checkedInSet = useMemo(() => new Set(checkedInEventIds), [checkedInEventIds]);

  const weeks = useMemo(() => {
    const firstOfMonth = startOfMonth(monthCursor);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }

    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [monthCursor]);

  function eventsOn(day: Date) {
    return events.filter((e) => sameDay(new Date(e.starts_at), day));
  }

  const selectedEvents = eventsOn(selectedDate).sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Calendar</h1>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() =>
              setMonthCursor(
                (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
              )
            }
            className="rounded-md border border-surface-border px-2 py-1"
          >
            ‹
          </button>
          <span className="font-medium min-w-[9rem] text-center">
            {monthCursor.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            onClick={() =>
              setMonthCursor(
                (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
              )
            }
            className="rounded-md border border-surface-border px-2 py-1"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day, i) => {
          const inMonth = day.getMonth() === monthCursor.getMonth();
          const dayEvents = eventsOn(day);
          const isSelected = sameDay(day, selectedDate);
          const isToday = sameDay(day, new Date());

          return (
            <button
              key={i}
              onClick={() => setSelectedDate(day)}
              className={`aspect-square rounded-md border p-1 text-left flex flex-col ${
                isSelected
                  ? "border-acacia-gold bg-acacia-gold/10"
                  : "border-surface-border"
              } ${inMonth ? "" : "opacity-30"}`}
            >
              <span
                className={`text-xs ${
                  isToday
                    ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-acacia-black text-white"
                    : ""
                }`}
              >
                {day.getDate()}
              </span>
              <span className="mt-auto flex flex-wrap gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT_CLASS[e.category]}`}
                    title={e.name}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-surface-border pt-4 space-y-3">
        <h2 className="text-sm font-medium text-muted">
          {selectedDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h2>

        {selectedEvents.length === 0 && (
          <p className="text-sm text-muted-foreground">No events this day.</p>
        )}

        <ul className="space-y-3">
          {selectedEvents.map((event) => {
            const status = eventStatus(event);
            const alreadyCheckedIn = checkedInSet.has(event.id);

            return (
              <li
                key={event.id}
                className="rounded-lg border border-surface-border p-3 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                  {event.description && (
                    <p className="text-sm text-muted">{event.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(event.starts_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    –{" "}
                    {new Date(event.ends_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  {event.address && (
                    <p className="text-xs text-muted-foreground">{event.address}</p>
                  )}
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(event.category)}`}
                    >
                      {categoryLabel(event.category)}
                    </span>
                    {event.hours > 0 && (
                      <span className="inline-block rounded-full bg-acacia-gold text-acacia-black px-2 py-0.5 text-xs font-medium">
                        {event.hours} hr{event.hours === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {alreadyCheckedIn ? (
                    <span className="text-sm text-acacia-green font-medium">
                      ✓ Checked in
                    </span>
                  ) : status === "open" ? (
                    <CheckInButton eventId={event.id} />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {status === "upcoming" ? "Not open yet" : "Closed"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
