// Every permission an admin can grant per role (pledge / active / exec).
// Admins always have everything. The defaults here must match the seed in
// supabase/schema.sql (role_permissions) — they mirror how the app behaved
// before roles were editable. Generated once; edit both together.
export type Role = "pledge" | "active" | "exec";
export const ROLES: { value: Role; label: string }[] = [
  { value: "pledge", label: "Pledge" },
  { value: "active", label: "Active" },
  { value: "exec", label: "Exec" },
];

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
  /** For tab permissions: the route it gates. */
  path: string | null;
  defaults: Record<Role, boolean>;
}

export const PERMISSIONS: PermissionDef[] = [
  { key: "tab_events", label: "Events", group: "Events", path: "/dashboard/events", defaults: { pledge: true, active: true, exec: true } },
  { key: "check_in_events", label: "Check in to events", group: "Events", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "manage_event_files", label: "Upload and delete event files", group: "Events", path: null, defaults: { pledge: false, active: false, exec: false } },
  { key: "review_excuses", label: "Review and decide event excuses", group: "Events", path: null, defaults: { pledge: false, active: false, exec: false } },
  { key: "view_event_feedback", label: "See event feedback and ratings", group: "Events", path: null, defaults: { pledge: false, active: false, exec: false } },
  { key: "tab_calendar", label: "Calendar", group: "Calendar", path: "/dashboard/calendar", defaults: { pledge: true, active: true, exec: true } },
  { key: "edit_calendar", label: "Add, edit and delete calendar events", group: "Calendar", path: null, defaults: { pledge: false, active: false, exec: false } },
  { key: "calendar_view_day", label: "Calendar: Day view", group: "Calendar", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "calendar_view_week", label: "Calendar: Week view", group: "Calendar", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "calendar_view_month", label: "Calendar: Month view", group: "Calendar", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "tab_chat", label: "Chat", group: "Chat", path: "/dashboard/chat", defaults: { pledge: true, active: true, exec: true } },
  { key: "chat_all", label: "Read & post in the All members chat", group: "Chat", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "chat_actives", label: "Read & post in the Actives chat", group: "Chat", path: null, defaults: { pledge: false, active: true, exec: true } },
  { key: "chat_exec", label: "Read & post in the Exec chat", group: "Chat", path: null, defaults: { pledge: false, active: false, exec: true } },
  { key: "chat_pledges", label: "Read & post in the Pledge chat", group: "Chat", path: null, defaults: { pledge: true, active: false, exec: false } },
  { key: "chat_post", label: "Send messages", group: "Chat", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "chat_react", label: "React to messages", group: "Chat", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "chat_attach_files", label: "Attach files to messages", group: "Chat", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "tab_gallery", label: "Gallery", group: "Gallery", path: "/dashboard/gallery", defaults: { pledge: true, active: true, exec: true } },
  { key: "upload_gallery", label: "Upload gallery photos", group: "Gallery", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "delete_any_gallery_photo", label: "Delete other people's gallery photos", group: "Gallery", path: null, defaults: { pledge: false, active: false, exec: false } },
  { key: "tab_dues", label: "Dues", group: "Dues", path: "/dashboard/dues", defaults: { pledge: true, active: true, exec: true } },
  { key: "manage_dues", label: "Create dues and record payments", group: "Dues", path: null, defaults: { pledge: false, active: false, exec: false } },
  { key: "tab_polls", label: "Polls", group: "Polls", path: "/dashboard/polls", defaults: { pledge: true, active: true, exec: true } },
  { key: "create_polls", label: "Create and manage polls", group: "Polls", path: null, defaults: { pledge: false, active: false, exec: true } },
  { key: "see_poll_results", label: "See poll results before answering", group: "Polls", path: null, defaults: { pledge: false, active: false, exec: false } },
  { key: "tab_chapter", label: "Chapter", group: "Chapter", path: "/dashboard/chapter", defaults: { pledge: true, active: true, exec: true } },
  { key: "chapter_main", label: "Chapter: Chapter subtab (records)", group: "Chapter", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "view_exec_chapter", label: "See the Exec tab in Chapter", group: "Chapter", path: null, defaults: { pledge: false, active: false, exec: true } },
  { key: "post_chapter_records", label: "Post chapter records (notes + files)", group: "Chapter", path: null, defaults: { pledge: false, active: false, exec: true } },
  { key: "tab_pledgeship", label: "Pledgeship", group: "Pledgeship", path: "/dashboard/pledgeship", defaults: { pledge: true, active: true, exec: true } },
  { key: "pledgeship_schedule", label: "See the pledge schedule", group: "Pledgeship", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "pledgeship_quizzes", label: "Use the pledge quizzes", group: "Pledgeship", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "tab_house_points", label: "House Points", group: "House Points", path: "/dashboard/house-points", defaults: { pledge: true, active: true, exec: true } },
  { key: "tab_house_presence", label: "House Presence", group: "House Presence", path: "/dashboard/house-presence", defaults: { pledge: false, active: false, exec: true } },
  { key: "house_map", label: "House Presence: location map", group: "House Presence", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "house_range_day", label: "House Presence map: Last 24 hours", group: "House Presence", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "house_range_week", label: "House Presence map: Last 7 days", group: "House Presence", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "house_roster", label: "House Presence: member list", group: "House Presence", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "house_filter_all", label: "House Presence list: Everyone", group: "House Presence", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "house_filter_away", label: "House Presence list: Not at the house", group: "House Presence", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "house_filter_pledges", label: "House Presence list: Pledges", group: "House Presence", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "house_tracking_setup", label: "House Presence: always-on tracking setup", group: "House Presence", path: null, defaults: { pledge: true, active: true, exec: true } },
  { key: "view_all_locations", label: "See everyone's location history", group: "House Presence", path: null, defaults: { pledge: false, active: false, exec: false } },
  { key: "tab_parking", label: "Parking", group: "Parking", path: "/dashboard/parking", defaults: { pledge: true, active: true, exec: true } },
  { key: "manage_any_parking", label: "Edit anyone's parking info", group: "Parking", path: null, defaults: { pledge: false, active: false, exec: false } },
  { key: "view_pledge_grades", label: "See pledges' grades", group: "Grades", path: null, defaults: { pledge: false, active: false, exec: false } },
];

export function roleOf(profile: { is_pledge: boolean; is_exec: boolean }): Role {
  if (profile.is_pledge) return "pledge";
  if (profile.is_exec) return "exec";
  return "active";
}

/** The permission keys a person holds (admins hold all of them). */
export function allowedKeys(
  profile: { role: string; is_pledge: boolean; is_exec: boolean },
  rows: { role: string; permission: string; allowed: boolean }[],
): Set<string> {
  if (profile.role === "admin") return new Set(PERMISSIONS.map((p) => p.key));
  const role = roleOf(profile);
  const stored = new Map(
    rows.filter((r) => r.role === role).map((r) => [r.permission, r.allowed]),
  );
  return new Set(
    PERMISSIONS.filter((p) => stored.get(p.key) ?? p.defaults[role]).map((p) => p.key),
  );
}

/** Which permission gates a dashboard path, if any. */
export function permissionForPath(pathname: string): string | null {
  return PERMISSIONS.find((p) => p.path && pathname.startsWith(p.path))?.key ?? null;
}
