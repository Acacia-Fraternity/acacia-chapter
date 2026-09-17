import { createEvent } from "./actions";
import { LocationPicker } from "@/components/location-picker";

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
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            rows={2}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <LocationPicker />

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
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Starts</label>
            <input
              name="starts_at"
              type="datetime-local"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ends</label>
            <input
              name="ends_at"
              type="datetime-local"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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
