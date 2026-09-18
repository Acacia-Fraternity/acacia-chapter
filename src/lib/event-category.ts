import type { EventCategory } from "@/lib/types";

export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "chapter_meeting", label: "Chapter meeting" },
  { value: "social", label: "Party / social" },
  { value: "philanthropy", label: "Philanthropy" },
  { value: "other", label: "Other" },
];

export function categoryLabel(category: EventCategory): string {
  return EVENT_CATEGORIES.find((c) => c.value === category)?.label ?? "Other";
}

export function categoryBadgeClass(category: EventCategory): string {
  switch (category) {
    case "chapter_meeting":
      return "bg-acacia-blue/15 text-acacia-blue";
    case "social":
      return "bg-acacia-gold/25 text-acacia-black";
    case "philanthropy":
      return "bg-acacia-green/15 text-acacia-green";
    default:
      return "bg-surface-border text-muted";
  }
}
