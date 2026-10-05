import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "./actions";
import { LocationPicker } from "@/components/location-picker";
import { EventTypeFields } from "@/components/event-type-fields";
import { RsvpFields } from "@/components/rsvp-fields";
import { AssigneePicker } from "@/components/assignee-picker";
import { allowedKeys } from "@/lib/permissions";
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
  const { data: permRows } = await supabase.from("role_permissions").select("*");
  if (
    profile?.role !== "admin" &&
    !profile?.can_edit_calendar &&
    !allowedKeys(profile!, permRows ?? []).has("edit_calendar")
  ) {
    redirect("/dashboard/calendar");
  }

  // Pledges aren't offered as sober brothers.
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("is_pledge", false)
    .order("full_name");

  // Assignment, unlike the sober list, covers every brother including pledges.
  const { data: allMembers } = await supabase
    .from("profiles")
    .select("id, full_name, is_pledge")
    .order("full_name");

  return (
    <div className="space-y-4 max-w-lg mx-auto">
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
          <label className="block text-sm font-medium mb-1">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            name="description"
            rows={2}
            className="w-full rounded-md border border-surface-border px-3 py-2 text-sm"
          />
        </div>

        <EventTypeFields
          members={(members ?? []).map((m) => ({
            id: m.id,
            name: m.full_name || "(no name)",
          }))}
        />

        <LocationPicker />

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

        <RsvpFields />

        <AssigneePicker
          members={(allMembers ?? []).map((m) => ({
            id: m.id,
            name: (m.full_name || "(no name)") + (m.is_pledge ? " (pledge)" : ""),
          }))}
        />

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
