import { CHAPTER_TZ } from "@/lib/chapter-time";

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// due_date is a plain calendar date; parse it as one (not as midnight UTC,
// which would show the previous day in Bloomington).
export function formatDueDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Today's calendar date (YYYY-MM-DD) in the chapter's timezone. */
export function chapterToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: CHAPTER_TZ });
}

/** Whole days from today until `date` (negative = overdue). */
export function daysUntil(date: string, today = chapterToday()): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
