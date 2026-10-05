export interface Profile {
  id: string;
  full_name: string;
  role: "member" | "admin";
  can_chat: boolean;
  can_react: boolean;
  lives_in_house: boolean;
  is_pledge: boolean;
  can_edit_calendar: boolean;
  is_exec: boolean;
  on_pledge_committee: boolean;
  created_at: string;
}

export type EventCategory =
  | "chapter_meeting"
  | "philanthropy"
  | "social"
  | "party"
  | "wine_night"
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
  rsvp_required: boolean;
  rsvp_deadline: string | null;
  category: EventCategory;
  sorority: string;
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

export interface EventSoberBrother {
  event_id: string;
  user_id: string;
}

export interface EventAssignment {
  event_id: string;
  user_id: string;
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

export interface GalleryPhoto {
  id: string;
  user_id: string;
  event_id: string | null;
  album: string;
  storage_path: string;
  thumb_path: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface DuesCharge {
  id: string;
  batch_id: string;
  user_id: string;
  title: string;
  amount_cents: number;
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

export interface CanvasGrade {
  user_id: string;
  course_id: number;
  course_name: string;
  current_score: number | null;
  current_grade: string | null;
  synced_at: string;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  allow_multiple: boolean;
  anonymous: boolean;
  required: boolean;
  audience: "everyone" | "actives" | "pledges" | "exec";
  closes_at: string | null;
  closed: boolean;
  created_by: string | null;
  created_at: string;
}

export interface PollVote {
  poll_id: string;
  user_id: string;
  option_index: number;
}
