import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TaskList } from "@/components/task-list";
import { categoryLabel, categoryBadgeClass } from "@/lib/event-category";
import type { Profile, Task, Event } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: tasks }, { data: upcoming }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true })
      .returns<Task[]>(),
    supabase
      .from("events")
      .select("*")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5)
      .returns<Event[]>(),
  ]);

  const firstName = (profile?.full_name || "").trim().split(/\s+/)[0] || "brother";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Hello, brother {firstName}
        </h1>
        <p className="text-sm text-muted">Here&apos;s what&apos;s going on.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Your to-do list</h2>
        <TaskList initialTasks={tasks ?? []} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Upcoming events</h2>
          <Link href="/dashboard/events" className="text-xs text-acacia-blue hover:underline">
            View all
          </Link>
        </div>

        {(!upcoming || upcoming.length === 0) && (
          <p className="text-sm text-muted-foreground">Nothing coming up.</p>
        )}

        <ul className="space-y-2">
          {upcoming?.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-surface-border p-3 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium">{event.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.starts_at).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span
                className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(event.category)}`}
              >
                {categoryLabel(event.category)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
