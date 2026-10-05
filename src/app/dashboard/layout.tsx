import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { PresenceTracker } from "@/components/presence-tracker";
import { ScreenProtection } from "@/components/screen-protection";
import type { Profile } from "@/lib/types";

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

  return (
    <div className="flex flex-1">
      <PresenceTracker />
      <ScreenProtection label={profile?.full_name || user.email || "member"} />
      <DashboardSidebar
        fullName={profile?.full_name ?? ""}
        isAdmin={profile?.role === "admin"}
        seesGrades={
          profile?.role === "admin" || !!profile?.is_pledge || !!profile?.on_pledge_committee
        }
      />
      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6">
        {/* A page can opt out of the reading-width cap by rendering a data-wide element (the calendar does). */}
        <div className="max-w-4xl mx-auto has-[[data-wide]]:max-w-none">{children}</div>
      </main>
    </div>
  );
}
