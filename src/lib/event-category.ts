import type { EventCategory } from "@/lib/types";

// What can be chosen when creating an event.
export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "chapter_meeting", label: "Chapter" },
  { value: "philanthropy", label: "Philo event" },
  { value: "social", label: "Social event" },
  { value: "party", label: "Party" },
];

// Types that get the "Sober?" question.
export const SOBER_CATEGORIES: EventCategory[] = ["social", "party"];

// "other" and "general_social" are legacy values still allowed by the
// database (the imported calendar defaulted to "other"); they just aren't
// offered for new events.
export function categoryLabel(category: EventCategory): string {
  if (category === "other") return "Other";
  if (category === "general_social") return "General social event";
  return EVENT_CATEGORIES.find((c) => c.value === category)?.label ?? "Other";
}

export function categoryBadgeClass(category: EventCategory): string {
  switch (category) {
    case "chapter_meeting":
      return "bg-acacia-blue/15 text-acacia-blue";
    case "philanthropy":
      return "bg-acacia-green/15 text-acacia-green";
    case "social":
      return "bg-acacia-gold/25 text-acacia-black";
    case "party":
      return "bg-purple-500/20 text-purple-700";
    case "general_social":
      return "bg-orange-400/25 text-orange-700";
    default:
      return "bg-surface-border text-muted";
  }
}
