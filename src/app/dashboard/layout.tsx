import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
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
      <DashboardSidebar
        fullName={profile?.full_name ?? ""}
        isAdmin={profile?.role === "admin"}
      />
      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6">
        <div className="max-w-4xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
