export interface Profile {
  id: string;
  full_name: string;
  role: "member" | "admin";
  can_chat: boolean;
  can_react: boolean;
  lives_in_house: boolean;
  is_pledge: boolean;
  can_edit_calendar: boolean;
  created_at: string;
}

export type EventCategory =
  | "chapter_meeting"
  | "philanthropy"
  | "social"
  | "party"
  | "general_social"
  | "other";

export interface Event {
  id: string;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  hours: number;
  house_points: number;
  category: EventCategory;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
}

export interface Checkin {
  id: string;
  event_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  accuracy_meters: number | null;
  flagged_suspicious: boolean;
  flag_reason: string | null;
  hours_earned: number;
  checked_out_at: string | null;
  checked_in_at: string;
}

export interface ChapterNote {
  id: string;
  title: string;
  content: string;
  category: "chapter" | "exec";
  folder: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChapterFile {
  id: string;
  title: string;
  storage_path: string;
  external_url: string | null;
  category: "chapter" | "exec";
  folder: string;
  uploaded_by: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  created_at: string;
}

export interface HousePresenceSession {
  id: string;
  user_id: string;
  started_at: string;
  last_ping_at: string;
  ended_at: string | null;
  source: "auto" | "manual";
}

export interface ParkingSpot {
  id: string;
  user_id: string;
  spot_number: string;
  license_plate: string;
  make_model: string;
  notes: string;
  updated_at: string;
}

export interface EventPresence {
  event_id: string;
  user_id: string;
  minutes_on_site: number;
}

export interface EventFile {
  id: string;
  event_id: string;
  title: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export type RsvpStatus = "going" | "maybe" | "not_going";

export interface EventRsvp {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
}

export interface EventExcuse {
  event_id: string;
  user_id: string;
  reason: string;
  status: "pending" | "approved" | "denied";
}

export interface EventFeedback {
  event_id: string;
  user_id: string;
  rating: number;
  comments: string;
}
