import { createEvent } from "./actions";
import { LocationPicker } from "@/components/location-picker";
import { EVENT_CATEGORIES } from "@/lib/event-category";

export default function NewEventPage() {
  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-lg font-semibold">New event</h1>

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
            defaultValue="other"
            className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
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
              Hours awarded
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
              For philanthropy/service events — checking in credits this many
              hours. Leave 0 for a normal meeting/social.
            </p>
          </div>
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
