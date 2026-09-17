export interface Profile {
  id: string;
  full_name: string;
  role: "member" | "admin";
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
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
  checked_in_at: string;
}
