import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatChapterTime } from "@/lib/chapter-time";
import { MemberPermissionsRow } from "@/components/member-permissions-row";
import { AddMemberForm } from "@/components/add-member-form";
import { BulkAddMembers } from "@/components/bulk-add-members";
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
    .select("*")
    .order("starts_at", { ascending: false })
    .returns<Event[]>();

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
  const checkinStatsByEventId = new Map<string, { total: number; flagged: number }>();
  for (const checkin of allCheckins ?? []) {
    hoursByUserId.set(
      checkin.user_id,
      (hoursByUserId.get(checkin.user_id) ?? 0) + Number(checkin.hours_earned),
    );

    const stats = checkinStatsByEventId.get(checkin.event_id) ?? { total: 0, flagged: 0 };
    stats.total += 1;
    if (checkin.flagged_suspicious) stats.flagged += 1;
    checkinStatsByEventId.set(checkin.event_id, stats);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin</h1>
        <Link
          href="/dashboard/calendar/new"
          className="rounded-md bg-acacia-black text-white px-3 py-1.5 text-sm font-semibold"
        >
          New event
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Events</h2>
        <ul className="space-y-2">
          {events?.map((event) => {
            const stats = checkinStatsByEventId.get(event.id);
            return (
              <li
                key={event.id}
                className="rounded-lg border border-surface-border p-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatChapterTime(event.starts_at, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <span className="text-sm text-muted">
                  {stats?.total ?? 0} checked in
                  {stats?.flagged ? (
                    <span
                      className="ml-1.5 text-amber-600"
                      title="One or more check-ins were flagged for review — see checkins.flag_reason"
                    >
                      ⚠ {stats.flagged} flagged
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
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
        <BulkAddMembers />

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
