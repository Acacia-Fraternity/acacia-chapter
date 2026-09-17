export interface Profile {
  id: string;
  full_name: string;
  role: "member" | "admin";
  can_chat: boolean;
  can_react: boolean;
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  hours: number;
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
  hours_earned: number;
  checked_in_at: string;
}

export interface ChapterNote {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChapterFile {
  id: string;
  title: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
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
