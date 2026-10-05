import { createClient } from "@/lib/supabase/server";
import { DuesAdmin, type DuesBatch } from "@/components/dues-admin";
import { daysUntil, formatDueDate, formatMoney } from "@/lib/dues";
import type { DuesCharge, Profile } from "@/lib/types";

export default async function DuesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: charges }, { data: people }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single<Pick<Profile, "role">>(),
    supabase
      .from("dues_charges")
      .select("*")
      .order("due_date", { ascending: true })
      .returns<DuesCharge[]>(),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const isAdmin = profile?.role === "admin";
  // Admins can read everyone's rows, so narrow to their own for "Your dues".
  const mine = (charges ?? []).filter((c) => c.user_id === user!.id);
  const unpaid = mine.filter((c) => !c.paid_at);
  const paid = mine.filter((c) => c.paid_at);
  const owedCents = unpaid.reduce((sum, c) => sum + c.amount_cents, 0);

  let batches: DuesBatch[] = [];
  if (isAdmin) {
    const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name || "Unnamed"]));
    const byBatch = new Map<string, DuesBatch>();
    for (const c of charges ?? []) {
      const batch = byBatch.get(c.batch_id) ?? {
        batchId: c.batch_id,
        title: c.title,
        amountCents: c.amount_cents,
        dueDate: c.due_date,
        rows: [],
      };
      batch.rows.push({ id: c.id, name: nameById.get(c.user_id) ?? "Unknown", paid: !!c.paid_at });
      byBatch.set(c.batch_id, batch);
    }
    batches = Array.from(byBatch.values())
      .map((b) => ({ ...b, rows: b.rows.sort((a, z) => a.name.localeCompare(z.name)) }))
      .sort((a, z) => z.dueDate.localeCompare(a.dueDate));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Dues</h1>
        <p className="text-xs text-muted-foreground">
          Turn on notifications in Personalization to get reminders a week before, the day
          before, on the due date, and while a payment is late.
        </p>
      </div>

      <section className="space-y-3">
        <div className="rounded-lg border border-surface-border p-4">
          <p className="text-xs text-muted">You owe</p>
          <p className="text-2xl font-bold">{formatMoney(owedCents)}</p>
        </div>

        {unpaid.length === 0 && (
          <p className="text-sm text-muted-foreground">You&apos;re all paid up.</p>
        )}
        <ul className="space-y-2">
          {unpaid.map((c) => {
            const days = daysUntil(c.due_date);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-surface-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDueDate(c.due_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatMoney(c.amount_cents)}</p>
                  <p
                    className={`text-xs ${
                      days < 0 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    {days < 0
                      ? `${-days} day${days === -1 ? "" : "s"} overdue`
                      : days === 0
                        ? "Due today"
                        : `in ${days} day${days === 1 ? "" : "s"}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {paid.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">Paid</h2>
          <ul className="space-y-1">
            {paid.map((c) => (
              <li key={c.id} className="flex justify-between text-sm text-muted">
                <span>{c.title}</span>
                <span>{formatMoney(c.amount_cents)} ✓</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && <DuesAdmin batches={batches} />}
    </div>
  );
}
