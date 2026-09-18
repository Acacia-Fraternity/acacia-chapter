import { createClient } from "@/lib/supabase/server";
import { LivesInHouseToggle } from "@/components/lives-in-house-toggle";
import { PresenceToggle } from "@/components/presence-toggle";
import type { Profile, HousePresenceSession } from "@/lib/types";

function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

export default async function HousePresencePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: members }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("profiles").select("*").order("full_name").returns<Profile[]>(),
    supabase
      .from("house_presence_sessions")
      .select("*")
      .gte("started_at", startOfWeek().toISOString())
      .returns<HousePresenceSession[]>(),
  ]);

  const isAdmin = profile?.role === "admin";
  const now = new Date().getTime();

  const hoursByUserId = new Map<string, number>();
  const currentlyHomeSet = new Set<string>();

  for (const session of sessions ?? []) {
    const start = new Date(session.started_at).getTime();
    const end = session.ended_at ? new Date(session.ended_at).getTime() : now;
    const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
    hoursByUserId.set(session.user_id, (hoursByUserId.get(session.user_id) ?? 0) + hours);

    if (!session.ended_at) currentlyHomeSet.add(session.user_id);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">House Presence</h1>
        <p className="text-sm text-muted-foreground">
          Hours are approximate — only counted while the app is open near the
          house (phones don&apos;t allow background location for websites).
          Use &quot;I&apos;m home&quot;/&quot;I&apos;m leaving&quot; to cover the gaps.
        </p>
      </div>

      <ul className="space-y-2">
        {members?.map((member) => {
          const isSelf = member.id === user!.id;
          const isHome = currentlyHomeSet.has(member.id);
          const hours = hoursByUserId.get(member.id) ?? 0;

          return (
            <li
              key={member.id}
              className="rounded-lg border border-surface-border p-3 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isHome && (
                  <span
                    className="h-2 w-2 rounded-full bg-acacia-green shrink-0"
                    title="Currently home"
                  />
                )}
                <span className="text-sm font-medium truncate">
                  {member.full_name || "(no name set)"}
                  {isSelf && <span className="text-muted-foreground"> (you)</span>}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <LivesInHouseToggle
                  userId={member.id}
                  livesInHouse={member.lives_in_house}
                  canEdit={isSelf || isAdmin}
                />
                <span className="text-xs text-muted-foreground">
                  {hours.toFixed(1)} hrs this week
                </span>
                {isSelf && <PresenceToggle isCurrentlyHome={isHome} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
