import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
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
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="font-semibold">
              Acacia
            </Link>
            {profile?.role === "admin" && (
              <Link href="/dashboard/admin" className="text-sm text-neutral-500 hover:text-neutral-800">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500">{profile?.full_name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
