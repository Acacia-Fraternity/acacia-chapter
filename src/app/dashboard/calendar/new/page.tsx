import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "./actions";
import { LocationPicker } from "@/components/location-picker";
import { EVENT_CATEGORIES } from "@/lib/event-category";
import type { Profile } from "@/lib/types";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  // The database (can_edit_calendar() + RLS on events) is the real gate;
  // this just keeps everyone else off a form that would fail on submit.
  if (profile?.role !== "admin" && !profile?.can_edit_calendar) {
    redirect("/dashboard/calendar");
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">New event</h1>
        <Link href="/dashboard/calendar" className="text-sm text-muted underline">
          Cancel
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Times are Bloomington (Eastern) time.
      </p>

      <form action={createEvent} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            rows={2}
            className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
          />
        </div>

        <LocationPicker />

        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            name="category"
            defaultValue="chapter_meeting"
            className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Philo events are strict: brothers must check in at the address and
            check out there too, and service hours are the time actually spent
            on site.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              Check-in radius (meters)
            </label>
            <input
              name="radius_meters"
              type="number"
              defaultValue={100}
              min={5}
              required
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Service hours (max)
            </label>
            <input
              name="hours"
              type="number"
              step="0.5"
              min={0}
              defaultValue={0}
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Philo events only. Hours are earned by time on site (check-in to
              check-out), up to this cap; leave 0 to cap at the event&apos;s
              length. Ignored for other types.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">House points</label>
          <input
            name="house_points"
            type="number"
            min={0}
            defaultValue={0}
            className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Points a brother earns toward house points. Leave 0 if this event
            isn&apos;t worth points.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Starts</label>
            <input
              name="starts_at"
              type="datetime-local"
              required
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ends</label>
            <input
              name="ends_at"
              type="datetime-local"
              required
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded-md bg-acacia-gold text-acacia-black px-4 py-2 text-sm font-semibold"
        >
          Create event
        </button>
      </form>
    </div>
  );
}
