"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chapterWallTimeToIso } from "@/lib/chapter-time";

// The close time, ownership and permission rules all live in the
// add/update/remove/check_in Postgres functions; these only shape input.

export interface GuestInput {
  firstName: string;
  lastName: string;
  gender: string;
  relationship: string;
  house: string;
  referralId: string;
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/guest-lists");
}

function guestArgs(g: GuestInput) {
  if (!g.firstName.trim() || !g.lastName.trim()) throw new Error("First and last name are required");
  if (!["female", "male", "other"].includes(g.gender)) throw new Error("Pick a gender");
  if (!g.house) throw new Error("Pick a house affiliation");
  if (!g.referralId) throw new Error("Pick the active referral");
  return {
    p_first: g.firstName,
    p_last: g.lastName,
    p_gender: g.gender,
    p_relationship: g.relationship,
    p_house: g.house,
    p_referral: g.referralId,
  };
}

export async function addGuest(eventId: string, g: GuestInput) {
  await rpc("add_party_guest", { p_event_id: eventId, ...guestArgs(g) });
}

export async function updateGuest(guestId: string, g: GuestInput) {
  await rpc("update_party_guest", { p_guest_id: guestId, ...guestArgs(g) });
}

export async function removeGuest(guestId: string) {
  await rpc("remove_party_guest", { p_guest_id: guestId });
}

export async function setGuestCheckedIn(guestId: string, checked: boolean) {
  await rpc("check_in_party_guest", { p_guest_id: guestId, p_checked: checked });
}

/** Blank resets to the default (Wednesday 11:59 PM before the party). */
export async function setListClose(eventId: string, local: string) {
  await rpc("set_guest_list_close", {
    p_event_id: eventId,
    p_closes_at: local ? chapterWallTimeToIso(local) : null,
  });
}
