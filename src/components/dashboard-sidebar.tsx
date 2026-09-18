"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  Calendar,
  MessageSquare,
  BookOpen,
  Car,
  Palette,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { AcaciaCrest } from "@/components/acacia-crest";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_LINKS = [
  { href: "/dashboard/events", label: "Events", icon: CalendarCheck },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard/chapter", label: "Chapter", icon: BookOpen },
  { href: "/dashboard/parking", label: "Parking", icon: Car },
];

const STORAGE_KEY = "acacia-sidebar-collapsed";

export function DashboardSidebar({
  fullName,
  isAdmin,
}: {
  fullName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  // Starts false so the client's first render matches the server-rendered
  // HTML (no window/localStorage during SSR) — the effect below then syncs
  // in the real saved value right after hydration. Setting state directly
  // in an effect is normally an anti-pattern, but reading a browser-only
  // API like localStorage genuinely can't happen any earlier than this.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) === "1";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setCollapsed(true);
    } catch {
      // localStorage unavailable — keep the default (expanded).
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const links = isAdmin
    ? [...NAV_LINKS, { href: "/dashboard/admin", label: "Admin", icon: ShieldCheck }]
    : NAV_LINKS;

  const showLabels = !collapsed;
  const widthClass = collapsed ? "w-16" : "w-16 sm:w-56";

  return (
    <aside
      className={`${widthClass} shrink-0 bg-acacia-black text-white flex flex-col h-screen sticky top-0 transition-[width] duration-150`}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 py-4 border-b border-white/10">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold min-w-0"
        >
          <AcaciaCrest size={32} />
          {showLabels && <span className="hidden sm:inline truncate">Acacia</span>}
        </Link>
        <button
          onClick={toggleCollapsed}
          className="hidden sm:block text-neutral-400 hover:text-acacia-gold shrink-0"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 text-sm ${
                collapsed ? "justify-center" : "justify-center sm:justify-start"
              } ${
                isActive
                  ? "bg-white/10 text-acacia-gold border-l-2 border-acacia-gold"
                  : "text-neutral-300 hover:text-acacia-gold hover:bg-white/5 border-l-2 border-transparent"
              }`}
            >
              <Icon size={20} className="shrink-0" />
              {showLabels && <span className="hidden sm:inline">{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 sm:px-4 py-3 space-y-2">
        {showLabels && (
          <span className="hidden sm:block text-sm text-neutral-300 truncate">
            {fullName}
          </span>
        )}
        <Link
          href="/dashboard/personalization"
          title="Personalization"
          className={`flex items-center gap-3 text-sm text-neutral-300 hover:text-acacia-gold ${
            collapsed ? "justify-center" : "justify-center sm:justify-start"
          }`}
        >
          <Palette size={18} className="shrink-0" />
          {showLabels && <span className="hidden sm:inline">Personalization</span>}
        </Link>
        <div className={collapsed ? "flex justify-center" : "flex justify-center sm:justify-start"}>
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
