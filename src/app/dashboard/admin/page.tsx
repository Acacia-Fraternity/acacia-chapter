import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Event, Profile } from "@/lib/types";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: events } = await supabase
    .from("events")
    .select("*, checkins(count)")
    .order("starts_at", { ascending: false })
    .returns<(Event & { checkins: { count: number }[] })[]>();

  const { data: members } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")
    .returns<Profile[]>();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin</h1>
        <Link
          href="/dashboard/admin/new"
          className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium"
        >
          New event
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">Events</h2>
        <ul className="space-y-2">
          {events?.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-neutral-200 p-3 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{event.name}</p>
                <p className="text-xs text-neutral-400">
                  {new Date(event.starts_at).toLocaleString()}
                </p>
              </div>
              <span className="text-sm text-neutral-600">
                {event.checkins?.[0]?.count ?? 0} checked in
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">
          Members ({members?.length ?? 0})
        </h2>
        <p className="text-xs text-neutral-400">
          To promote or demote an admin, use the Supabase dashboard&apos;s Table
          Editor on the <code>profiles</code> table — this is intentionally not
          a button in the UI, so a compromised session can&apos;t mint new admins.
        </p>
        <ul className="space-y-1">
          {members?.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm border border-neutral-100"
            >
              <span>{member.full_name || "(no name set)"}</span>
              <span
                className={
                  member.role === "admin"
                    ? "text-xs font-medium text-neutral-900"
                    : "text-xs text-neutral-400"
                }
              >
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
