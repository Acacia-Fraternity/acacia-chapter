import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberPermissionsRow } from "@/components/member-permissions-row";
import { AddMemberForm } from "@/components/add-member-form";
import type { Event, Profile, Checkin } from "@/lib/types";

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

  const { data: allCheckins } = await supabase
    .from("checkins")
    .select("*")
    .returns<Checkin[]>();

  const hoursByUserId = new Map<string, number>();
  for (const checkin of allCheckins ?? []) {
    hoursByUserId.set(
      checkin.user_id,
      (hoursByUserId.get(checkin.user_id) ?? 0) + Number(checkin.hours_earned),
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin</h1>
        <Link
          href="/dashboard/admin/new"
          className="rounded-md bg-acacia-black text-white px-3 py-1.5 text-sm font-semibold"
        >
          New event
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Events</h2>
        <ul className="space-y-2">
          {events?.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-surface-border p-3 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{event.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.starts_at).toLocaleString()}
                </p>
              </div>
              <span className="text-sm text-muted">
                {event.checkins?.[0]?.count ?? 0} checked in
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">
          Members &amp; permissions ({members?.length ?? 0})
        </h2>
        <p className="text-xs text-muted-foreground">
          Chat/React control whether that person can post messages or add
          reactions. Changing these (and admin status) is enforced by the
          database itself, not just this screen — see{" "}
          <code>supabase/schema.sql</code>.
        </p>

        <AddMemberForm />

        <ul className="space-y-1.5">
          {members?.map((member) => (
            <MemberPermissionsRow
              key={member.id}
              member={member}
              isSelf={member.id === user!.id}
              hours={hoursByUserId.get(member.id) ?? 0}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
