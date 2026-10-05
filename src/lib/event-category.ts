import type { EventCategory } from "@/lib/types";

// "other" is only for events that predate these types (the imported calendar
// used it as the default); it isn't offered when creating a new event.
export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "chapter_meeting", label: "Chapter" },
  { value: "philanthropy", label: "Philo event" },
  { value: "social", label: "Social event" },
  { value: "party", label: "Party" },
  { value: "general_social", label: "General social event" },
];

export function categoryLabel(category: EventCategory): string {
  if (category === "other") return "Other";
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
