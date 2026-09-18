-- Acacia attendance/involvement tracker — schema
-- Run this once in the Supabase dashboard: Project > SQL Editor > New query > paste > Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE throughout).

-- ============================================================
-- profiles — one row per brother, linked 1:1 to Supabase auth.users.
-- `role` is what makes admin access TRANSFERABLE: it's data, not code.
-- Promoting the next officer is one UPDATE statement, not a redeploy.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'member' check (role in ('member', 'admin')),
  -- Independent of `role`: separate ON/OFF switches an admin can flip per
  -- member from the admin dashboard, e.g. to mute someone in chat without
  -- touching their membership status at all.
  can_chat boolean not null default true,
  can_react boolean not null default true,
  -- Housing status for the House Presence tab — whether this brother is
  -- assigned to live in the chapter house at all, distinct from whether
  -- they're *currently* there (house_presence_sessions tracks that).
  lives_in_house boolean not null default false,
  created_at timestamptz not null default now()
);

-- `create table if not exists` above is a no-op on a table that already
-- exists (this ran once already before lives_in_house existed) — this is
-- what actually adds the column to a live database. Safe to re-run.
alter table profiles add column if not exists lives_in_house boolean not null default false;

alter table profiles enable row level security;

-- Defined before any policy/trigger below that references it — CREATE POLICY
-- resolves function calls in USING/WITH CHECK immediately, unlike a plpgsql
-- function body, so is_admin() must already exist at that point.
create or replace function is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function can_chat()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select can_chat from profiles where id = auth.uid()), false);
$$;

create or replace function can_react()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select can_react from profiles where id = auth.uid()), false);
$$;

drop policy if exists "profiles are viewable by any signed-in member" on profiles;
create policy "profiles are viewable by any signed-in member"
  on profiles for select
  to authenticated
  using (true);

drop policy if exists "users can update their own profile name" on profiles;
drop policy if exists "users can update their own profile, admins can update anyone" on profiles;
create policy "users can update their own profile, admins can update anyone"
  on profiles for update
  to authenticated
  using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

-- IMPORTANT: Postgres RLS controls which ROWS a policy allows, not which
-- COLUMNS — the "update their own profile" half of the policy above would,
-- on its own, let any signed-in member run
-- `update profiles set role = 'admin' where id = auth.uid()` themselves.
-- This trigger is what actually stops that: it blocks any change to
-- role/can_chat/can_react unless the person making the change is already
-- an admin. This is the real enforcement; the admin dashboard UI is just
-- a convenience on top of it.
create or replace function prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_admin() and (
    new.role is distinct from old.role
    or new.can_chat is distinct from old.can_chat
    or new.can_react is distinct from old.can_react
  ) then
    raise exception 'Only an admin can change role, can_chat, or can_react';
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_permission_change on profiles;
create trigger on_profile_permission_change
  before update on profiles
  for each row execute procedure prevent_self_privilege_escalation();

-- New signups get a profile row automatically (default role: member).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- events — a meeting/philanthropy/chapter event with a location
-- and a radius (meters) brothers must be within to check in.
-- ============================================================
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  -- Human-readable address, for events created by typing an address
  -- (geocoded server-side to latitude/longitude) rather than standing at
  -- the venue and using "current location." Purely informational — the
  -- lat/lng columns are what check-in actually validates against.
  address text not null default '',
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 100,
  -- Service/philanthropy hours a check-in earns, e.g. for a philanthropy
  -- event where attendance counts toward a requirement. 0 for a normal
  -- meeting/social that doesn't award anything.
  hours numeric not null default 0,
  category text not null default 'other'
    check (category in ('chapter_meeting', 'social', 'philanthropy', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- `create table if not exists` above does nothing to a table that already
-- exists (this ran once already before `category` existed) — this is what
-- actually adds the column to a live database. Safe to re-run.
alter table events add column if not exists category text not null default 'other';
alter table events drop constraint if exists events_category_check;
alter table events add constraint events_category_check
  check (category in ('chapter_meeting', 'social', 'philanthropy', 'other'));

alter table events enable row level security;

drop policy if exists "events are viewable by any signed-in member" on events;
create policy "events are viewable by any signed-in member"
  on events for select
  to authenticated
  using (true);

drop policy if exists "only admins can create events" on events;
create policy "only admins can create events"
  on events for insert
  to authenticated
  with check (is_admin());

drop policy if exists "only admins can update events" on events;
create policy "only admins can update events"
  on events for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "only admins can delete events" on events;
create policy "only admins can delete events"
  on events for delete
  to authenticated
  using (is_admin());

-- ============================================================
-- checkins — one row per (event, member). Direct INSERT is blocked
-- for everyone (see policies below); the ONLY way to create a row
-- is the check_in() function, which verifies the caller is actually
-- within `radius_meters` of the event before writing anything. This
-- stops someone from forging a check-in via the browser dev console.
-- ============================================================
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  distance_meters double precision not null,
  -- Snapshotted from events.hours at check-in time (same reasoning as
  -- distance_meters above) — if an admin edits an event's hours value
  -- later, past check-ins keep the amount that was actually promised
  -- when the person showed up, rather than silently changing.
  hours_earned numeric not null default 0,
  checked_in_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table checkins enable row level security;

drop policy if exists "members see their own checkins, admins see all" on checkins;
create policy "members see their own checkins, admins see all"
  on checkins for select
  to authenticated
  using (auth.uid() = user_id or is_admin());

-- Deliberately no insert/update/delete policy for regular clients —
-- every write goes through check_in() below.

-- Haversine distance in meters between two lat/lng points.
create or replace function haversine_meters(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371000 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    ))
  );
$$;

create or replace function check_in(
  p_event_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns checkins
language plpgsql
security definer set search_path = public
as $$
declare
  v_event events;
  v_distance double precision;
  v_row checkins;
begin
  select * into v_event from events where id = p_event_id;

  if v_event is null then
    raise exception 'Event not found';
  end if;

  if now() < v_event.starts_at or now() > v_event.ends_at then
    raise exception 'This event is not currently open for check-in';
  end if;

  v_distance := haversine_meters(p_lat, p_lng, v_event.latitude, v_event.longitude);

  if v_distance > v_event.radius_meters then
    raise exception 'You are % meters away — you must be within % meters to check in',
      round(v_distance), v_event.radius_meters;
  end if;

  insert into checkins (event_id, user_id, latitude, longitude, distance_meters, hours_earned)
  values (p_event_id, auth.uid(), p_lat, p_lng, v_distance, v_event.hours)
  on conflict (event_id, user_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        distance_meters = excluded.distance_meters,
        checked_in_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function check_in(uuid, double precision, double precision) to authenticated;

-- ============================================================
-- messages — one shared chapter-wide chat. Reading is open to every
-- signed-in brother; POSTING is gated by profiles.can_chat. Like checkins,
-- there is deliberately no direct INSERT policy — send_message() is the
-- only path in, so the permission check can't be bypassed by calling the
-- table directly from the browser console.
-- ============================================================
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

drop policy if exists "messages are viewable by any signed-in member" on messages;
create policy "messages are viewable by any signed-in member"
  on messages for select
  to authenticated
  using (true);

drop policy if exists "members can delete their own messages, admins any" on messages;
create policy "members can delete their own messages, admins any"
  on messages for delete
  to authenticated
  using (auth.uid() = user_id or is_admin());

create or replace function send_message(p_content text)
returns messages
language plpgsql
security definer set search_path = public
as $$
declare
  v_row messages;
begin
  if not can_chat() then
    raise exception 'You do not have permission to send messages';
  end if;

  insert into messages (user_id, content)
  values (auth.uid(), trim(p_content))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function send_message(text) to authenticated;

-- ============================================================
-- message_reactions — emoji reactions on a message. Same pattern as
-- messages: no direct INSERT/DELETE policy, toggle_reaction() is the only
-- way in and it enforces profiles.can_react before writing anything.
-- ============================================================
create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table message_reactions enable row level security;

drop policy if exists "reactions are viewable by any signed-in member" on message_reactions;
create policy "reactions are viewable by any signed-in member"
  on message_reactions for select
  to authenticated
  using (true);

-- Toggles: adds the reaction if it's not there yet, removes it if it is.
-- Returns true if a reaction now exists, false if one was just removed.
create or replace function toggle_reaction(p_message_id uuid, p_emoji text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_existing uuid;
begin
  if not can_react() then
    raise exception 'You do not have permission to react to messages';
  end if;

  select id into v_existing
  from message_reactions
  where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;

  if v_existing is not null then
    delete from message_reactions where id = v_existing;
    return false;
  end if;

  insert into message_reactions (message_id, user_id, emoji)
  values (p_message_id, auth.uid(), p_emoji);
  return true;
end;
$$;

grant execute on function toggle_reaction(uuid, text) to authenticated;

-- Realtime: lets the chat UI subscribe to new messages/reactions over a
-- websocket instead of polling. Safe to re-run (no-ops if already added).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table message_reactions;
  end if;
end $$;

-- ============================================================
-- chapter_notes — meeting notes. Simple: title + freeform text (markdown-
-- ish, rendered as preformatted text, no WYSIWYG editor). Admin-authored,
-- everyone can read.
-- ============================================================
create table if not exists chapter_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chapter_notes enable row level security;

drop policy if exists "chapter notes are viewable by any signed-in member" on chapter_notes;
create policy "chapter notes are viewable by any signed-in member"
  on chapter_notes for select
  to authenticated
  using (true);

drop policy if exists "only admins can write chapter notes" on chapter_notes;
create policy "only admins can write chapter notes"
  on chapter_notes for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ============================================================
-- chapter_files — presentation slides / handouts. The actual file bytes
-- live in Supabase Storage (bucket "chapter-files", created below); this
-- table is just the metadata (title + which storage object it points to).
-- ============================================================
create table if not exists chapter_files (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null,
  uploaded_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

alter table chapter_files enable row level security;

drop policy if exists "chapter files are viewable by any signed-in member" on chapter_files;
create policy "chapter files are viewable by any signed-in member"
  on chapter_files for select
  to authenticated
  using (true);

drop policy if exists "only admins can manage chapter files" on chapter_files;
create policy "only admins can manage chapter files"
  on chapter_files for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Storage bucket for the actual file bytes (slides, PDFs, etc). Private —
-- not publicly readable by URL; every read goes through the app, which
-- checks auth like everything else here.
insert into storage.buckets (id, name, public)
values ('chapter-files', 'chapter-files', false)
on conflict (id) do nothing;

drop policy if exists "chapter-files: signed-in members can read" on storage.objects;
create policy "chapter-files: signed-in members can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chapter-files');

drop policy if exists "chapter-files: only admins can upload" on storage.objects;
create policy "chapter-files: only admins can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chapter-files' and is_admin());

drop policy if exists "chapter-files: only admins can delete" on storage.objects;
create policy "chapter-files: only admins can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chapter-files' and is_admin());

-- ============================================================
-- parking_spots — one row per brother who has a car on file. Self-service:
-- a brother manages their own row; admins can manage anyone's (e.g. to fix
-- a typo'd plate or remove someone who's graduated).
-- ============================================================
create table if not exists parking_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles (id) on delete cascade,
  spot_number text not null default '',
  license_plate text not null default '',
  make_model text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table parking_spots enable row level security;

drop policy if exists "parking info is viewable by any signed-in member" on parking_spots;
create policy "parking info is viewable by any signed-in member"
  on parking_spots for select
  to authenticated
  using (true);

drop policy if exists "members manage their own parking info, admins any" on parking_spots;
create policy "members manage their own parking info, admins any"
  on parking_spots for insert
  to authenticated
  with check (auth.uid() = user_id or is_admin());

drop policy if exists "members update their own parking info, admins any" on parking_spots;
create policy "members update their own parking info, admins any"
  on parking_spots for update
  to authenticated
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

drop policy if exists "members delete their own parking info, admins any" on parking_spots;
create policy "members delete their own parking info, admins any"
  on parking_spots for delete
  to authenticated
  using (auth.uid() = user_id or is_admin());

-- ============================================================
-- tasks — a personal to-do list per brother, shown on the Home page.
-- Purely private: unlike everything else in this app, nobody (not even
-- an admin) can see anyone else's tasks — there's no chapter-wide reason
-- to, and it's the kind of thing (errands, personal reminders) people
-- wouldn't want visible to others by default.
-- ============================================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;

drop policy if exists "members manage only their own tasks" on tasks;
create policy "members manage only their own tasks"
  on tasks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- house_presence_sessions — tracks time spent at the chapter house, for
-- the House Presence tab. IMPORTANT LIMITATION (by design, not a bug):
-- phones do not allow background location access for web apps — iOS in
-- particular gives web content zero location access once the app isn't
-- on-screen. So this can only ever be "time the app was open near the
-- house," logged two ways: automatically while the app happens to be
-- open (src/components/presence-tracker.tsx pings periodically), or a
-- manual "I'm home" / "I'm leaving" toggle to cover the gaps. True 24/7
-- presence tracking would require a native iOS/Android app with
-- "Always Allow" location permission — a separate project entirely,
-- not something a website can do regardless of user consent.
--
-- At most one OPEN session (ended_at is null) per user at a time,
-- enforced by the partial unique index below — log_presence_ping()
-- either continues that open session (bumping last_ping_at) or closes
-- it, depending on whether the caller's coordinates are still within
-- range of the house.
-- ============================================================
create table if not exists house_presence_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Bumped on every heartbeat while the session is open — lets the app
  -- tell "still here, just hasn't pinged in a bit" apart from "actually
  -- ended," without needing a cron job to close stale sessions.
  last_ping_at timestamptz not null default now(),
  ended_at timestamptz,
  source text not null default 'auto' check (source in ('auto', 'manual'))
);

create unique index if not exists house_presence_one_open_session
  on house_presence_sessions (user_id)
  where ended_at is null;

alter table house_presence_sessions enable row level security;

drop policy if exists "presence sessions are viewable by any signed-in member" on house_presence_sessions;
create policy "presence sessions are viewable by any signed-in member"
  on house_presence_sessions for select
  to authenticated
  using (true);

-- No direct insert/update policy for regular clients — every write goes
-- through log_presence_ping()/log_presence_leave() below, same reasoning
-- as checkins/messages: the geofence check can't be bypassed by calling
-- the table directly.

create or replace function log_presence_ping(p_lat double precision, p_lng double precision)
returns house_presence_sessions
language plpgsql
security definer set search_path = public
as $$
declare
  house_lat constant double precision := 39.1639078;
  house_lng constant double precision := -86.5255585;
  house_radius constant double precision := 150;
  v_within boolean;
  v_row house_presence_sessions;
begin
  v_within := haversine_meters(p_lat, p_lng, house_lat, house_lng) <= house_radius;

  select * into v_row from house_presence_sessions
  where user_id = auth.uid() and ended_at is null;

  if v_within then
    if v_row.id is null then
      insert into house_presence_sessions (user_id, started_at, last_ping_at, source)
      values (auth.uid(), now(), now(), 'auto')
      returning * into v_row;
    else
      update house_presence_sessions set last_ping_at = now()
      where id = v_row.id
      returning * into v_row;
    end if;
  else
    if v_row.id is not null then
      update house_presence_sessions set ended_at = now()
      where id = v_row.id
      returning * into v_row;
    end if;
  end if;

  return v_row;
end;
$$;

grant execute on function log_presence_ping(double precision, double precision) to authenticated;

-- Explicit "I'm leaving" — no geofence check, since someone declaring
-- they're leaving might already be out of range or losing signal in a car.
create or replace function log_presence_leave()
returns house_presence_sessions
language plpgsql
security definer set search_path = public
as $$
declare
  v_row house_presence_sessions;
begin
  update house_presence_sessions
  set ended_at = now()
  where user_id = auth.uid() and ended_at is null
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function log_presence_leave() to authenticated;

-- ============================================================
-- Bootstrap the first admin. Run this SEPARATELY, once, after you've
-- signed up in the app yourself — replace the email below with yours.
-- Every future admin promotion after this one can be done the same
-- way, by whoever currently holds admin, from the Supabase dashboard's
-- Table Editor (no code/redeploy needed — this IS the transfer mechanism).
-- ============================================================
-- update profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'you@example.com');
