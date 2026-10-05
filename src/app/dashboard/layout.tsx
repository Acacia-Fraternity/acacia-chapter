import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { PresenceTracker } from "@/components/presence-tracker";
import { ScreenProtection } from "@/components/screen-protection";
import { PollGate } from "@/components/poll-gate";
import { allowedKeys, permissionForPath } from "@/lib/permissions";
import type { Poll, Profile } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const { data: permRows } = await supabase.from("role_permissions").select("*");
  const allowed = allowedKeys(profile!, permRows ?? []);
  const pathname = (await headers()).get("x-pathname") ?? "";
  const gatedBy = permissionForPath(pathname);
  const blocked = gatedBy !== null && !allowed.has(gatedBy);

  // Recurring polls that have come due turn into real polls here, so a
  // required one gates this very load. Failure just means a later load tries again.
  await supabase.rpc("spawn_due_polls");

  // A required poll replaces the whole app until it is answered. RLS lets exec
  // see polls outside their audience, so the audience is re-checked here.
  const isExec = profile?.role === "admin" || !!profile?.is_exec;
  const isPledge = !!profile?.is_pledge;
  const [{ data: requiredPolls }, { data: myVotes }] = await Promise.all([
    supabase
      .from("polls")
      .select("*")
      .eq("required", true)
      .eq("closed", false)
      .order("created_at", { ascending: true })
      .returns<Poll[]>(),
    supabase.from("poll_votes").select("poll_id").eq("user_id", user.id),
  ]);
  const answered = new Set((myVotes ?? []).map((v) => v.poll_id));
  const pending = (requiredPolls ?? []).filter(
    (p) =>
      !answered.has(p.id) &&
      (!p.closes_at || new Date(p.closes_at).getTime() > new Date().getTime()) &&
      (p.audience === "everyone" ||
        (p.audience === "actives" && !isPledge) ||
        (p.audience === "pledges" && isPledge) ||
        (p.audience === "exec" && isExec)),
  );

  if (pending.length > 0) {
    const first = pending[0];
    return (
      <>
        <ScreenProtection />
        <PollGate
          poll={{
            id: first.id,
            question: first.question,
            options: first.options,
            allowMultiple: first.allow_multiple,
          }}
          remaining={pending.length}
        />
      </>
    );
  }

  return (
    <div className="flex flex-1">
      <PresenceTracker />
      <ScreenProtection />
      <DashboardSidebar
        fullName={profile?.full_name ?? ""}
        isAdmin={profile?.role === "admin"}
        allowed={Array.from(allowed)}
        seesGrades={
          profile?.role === "admin" ||
          !!profile?.is_pledge ||
          !!profile?.on_pledge_committee ||
          allowed.has("view_pledge_grades")
        }
      />
      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6">
        {/* A page can opt out of the reading-width cap by rendering a data-wide element (the calendar does). */}
        <div className="max-w-4xl mx-auto has-[[data-wide]]:max-w-none">
          {blocked ? (
            <p className="text-sm text-muted">
              Your role doesn&apos;t have access to this page. Ask an admin if you think that&apos;s a
              mistake.
            </p>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
