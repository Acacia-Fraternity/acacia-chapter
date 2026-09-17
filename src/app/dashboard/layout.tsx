import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { AcaciaMark } from "@/components/acacia-mark";
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
      <header className="bg-acacia-black text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-5">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold">
              <AcaciaMark size={28} />
              Acacia
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-neutral-300 hover:text-acacia-gold"
            >
              Events
            </Link>
            <Link
              href="/dashboard/chat"
              className="text-sm text-neutral-300 hover:text-acacia-gold"
            >
              Chat
            </Link>
            {profile?.role === "admin" && (
              <Link
                href="/dashboard/admin"
                className="text-sm text-neutral-300 hover:text-acacia-gold"
              >
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-300">{profile?.full_name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
