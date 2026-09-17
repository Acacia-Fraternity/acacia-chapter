import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { AcaciaCrest } from "@/components/acacia-crest";
import type { Profile } from "@/lib/types";

const NAV_LINKS = [
  { href: "/dashboard", label: "Events" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/chat", label: "Chat" },
  { href: "/dashboard/chapter", label: "Chapter" },
  { href: "/dashboard/parking", label: "Parking" },
  { href: "/dashboard/personalization", label: "Personalization" },
];

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
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 flex-wrap">
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold shrink-0">
              <AcaciaCrest size={28} />
              Acacia
            </Link>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-neutral-300 hover:text-acacia-gold"
              >
                {link.label}
              </Link>
            ))}
            {profile?.role === "admin" && (
              <Link
                href="/dashboard/admin"
                className="text-sm text-neutral-300 hover:text-acacia-gold"
              >
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-neutral-300">{profile?.full_name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
