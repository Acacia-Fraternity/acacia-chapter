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
-- Pledges get their own House Presence filter; admin-controlled (guarded by
-- prevent_self_privilege_escalation below, like role).
alter table profiles add column if not exists is_pledge boolean not null default false;
-- Lets a non-admin (e.g. the chapter president) add/edit/delete calendar
-- events without being granted full admin. Admin-controlled like role.
alter table profiles add column if not exists can_edit_calendar boolean not null default false;
-- Third member status next to pledge / active: Exec officers. `role = 'admin'`
-- still counts as exec everywhere (see is_exec()). Admin-controlled.
alter table profiles add column if not exists is_exec boolean not null default false;
-- Runs the pledge program: reads the pledge chat and sees pledge course
-- grades. Admin-controlled.
alter table profiles add column if not exists on_pledge_committee boolean not null default false;

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

create or replace function can_edit_calendar()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and (role = 'admin' or can_edit_calendar)
  );
$$;

create or replace function is_exec()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and (role = 'admin' or is_exec)
  );
$$;

create or replace function on_pledge_committee()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and (role = 'admin' or on_pledge_committee)
  );
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
  -- auth.uid() is null for direct database access (the Supabase SQL Editor,
  -- migrations) — not an app user, so there's no one to escalate. Every
  -- policy on profiles is `to authenticated`, so the API can never reach
  -- here without a uid. Without this, the very first admin can't be
  -- bootstrapped from the SQL Editor.
  if auth.uid() is not null and not is_admin() and (
    new.role is distinct from old.role
    or new.can_chat is distinct from old.can_chat
    or new.can_react is distinct from old.can_react
    or new.is_pledge is distinct from old.is_pledge
    or new.can_edit_calendar is distinct from old.can_edit_calendar
    or new.is_exec is distinct from old.is_exec
    or new.on_pledge_committee is distinct from old.on_pledge_committee
  ) then
    raise exception 'Only an admin can change role, chat/react/calendar permissions, or pledge/exec/committee status';
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
    check (category in ('chapter_meeting', 'philanthropy', 'social', 'party', 'wine_night', 'general_social', 'other')),
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
  check (category in ('chapter_meeting', 'philanthropy', 'social', 'party', 'wine_night', 'general_social', 'other'));
-- Which sorority a Wine night is with (empty for every other type).
alter table events add column if not exists sorority text not null default '';

-- "party" used to be folded into "social"; split out the events already
-- named as parties (idempotent: only touches rows still marked social).
update events set category = 'party' where category = 'social' and name ilike 'party%';

alter table events enable row level security;

drop policy if exists "events are viewable by any signed-in member" on events;
create policy "events are viewable by any signed-in member"
  on events for select
  to authenticated
  using (true);

drop policy if exists "only admins can create events" on events;
drop policy if exists "calendar editors can create events" on events;
create policy "calendar editors can create events"
  on events for insert
  to authenticated
  with check (can_edit_calendar());

drop policy if exists "only admins can update events" on events;
drop policy if exists "calendar editors can update events" on events;
create policy "calendar editors can update events"
  on events for update
  to authenticated
  using (can_edit_calendar())
  with check (can_edit_calendar());

drop policy if exists "only admins can delete events" on events;
drop policy if exists "calendar editors can delete events" on events;
create policy "calendar editors can delete events"
  on events for delete
  to authenticated
  using (can_edit_calendar());

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

-- Anti-spoofing hardening, added after the fact — see check_in() below.
-- accuracy_meters is the browser Geolocation API's own reported margin of
-- error; flagged_suspicious/flag_reason let a check-in that COULD be real
-- (unlike a plain out-of-radius rejection) still succeed but visibly warn
-- an admin, since these records affect real philanthropy-hours credit.
alter table checkins add column if not exists accuracy_meters double precision;
alter table checkins add column if not exists flagged_suspicious boolean not null default false;
alter table checkins add column if not exists flag_reason text;

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

-- Browser geolocation can't give us Android's isFromMockProvider (that
-- signal only exists in a native app) — so the two checks below are the
-- honest subset of the pasted anti-spoofing advice that's actually
-- possible from a PWA:
--   1. Reject a reading whose OWN reported accuracy is too poor to trust
--      (accuracy worse than this means the browser fell back to
--      wifi/IP-based positioning, not a real GPS fix — the "distance ≤
--      radius" check is meaningless if the position itself has a 500m
--      margin of error). This is a hard reject: ask the member to wait a
--      few seconds for a GPS lock and retry.
--   2. Flag (not reject) a checkin that implies impossible travel speed
--      since their last checkin anywhere. This can't distinguish "spoofed"
--      from "GPS drift/legitimately drove fast," so it only flags the row
--      for an admin to glance at later rather than blocking it.
create or replace function check_in(
  p_event_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null
)
returns checkins
language plpgsql
security definer set search_path = public
as $$
declare
  v_max_accuracy_meters constant double precision := 100;
  v_max_speed_mps constant double precision := 45; -- ~100 mph, generous above real driving speeds
  v_event events;
  v_distance double precision;
  v_prev checkins;
  v_flagged boolean := false;
  v_flag_reason text;
  v_row checkins;
begin
  select * into v_event from events where id = p_event_id;

  if v_event is null then
    raise exception 'Event not found';
  end if;

  -- Only RSVP events have check-in; the Pledge Duration bar never does.
  if not v_event.rsvp_required or v_event.name ilike '%pledge duration%' then
    raise exception 'This event does not have check-in';
  end if;

  if now() < v_event.starts_at or now() > v_event.ends_at then
    raise exception 'This event is not currently open for check-in';
  end if;

  if p_accuracy is not null and p_accuracy > v_max_accuracy_meters then
    raise exception 'Your location signal is too weak (± % m) to check in — move somewhere with a clearer sky view and try again',
      round(p_accuracy);
  end if;

  if p_accuracy is null then
    v_flagged := true;
    v_flag_reason := 'No location accuracy reported by the browser';
  end if;

  v_distance := haversine_meters(p_lat, p_lng, v_event.latitude, v_event.longitude);

  if v_distance > v_event.radius_meters then
    raise exception 'You are % meters away — you must be within % meters to check in',
      round(v_distance), v_event.radius_meters;
  end if;

  -- A second check-in would reset the start time, so for philanthropy
  -- (where hours are measured from it) it is refused outright.
  if v_event.category = 'philanthropy' and exists (
    select 1 from checkins where event_id = p_event_id and user_id = auth.uid()
  ) then
    raise exception 'You have already checked in to this event';
  end if;

  select * into v_prev
    from checkins
    where user_id = auth.uid() and event_id != p_event_id
    order by checked_in_at desc
    limit 1;

  if v_prev.id is not null then
    declare
      v_elapsed_seconds double precision := extract(epoch from (now() - v_prev.checked_in_at));
      v_prev_distance double precision := haversine_meters(p_lat, p_lng, v_prev.latitude, v_prev.longitude);
    begin
      if v_elapsed_seconds > 0 and (v_prev_distance / v_elapsed_seconds) > v_max_speed_mps then
        v_flagged := true;
        v_flag_reason := format(
          'Implausible travel speed from previous check-in (~%s mph over %s min)',
          round((v_prev_distance / v_elapsed_seconds) * 2.237),
          round((v_elapsed_seconds / 60.0)::numeric, 1)
        );
      end if;
    end;
  end if;

  insert into checkins (
    event_id, user_id, latitude, longitude, distance_meters, accuracy_meters,
    flagged_suspicious, flag_reason, hours_earned
  )
  values (
    p_event_id, auth.uid(), p_lat, p_lng, v_distance, p_accuracy,
    v_flagged, v_flag_reason,
    -- Philanthropy hours are earned by being there, credited at check-out.
    case when v_event.category = 'philanthropy' then 0 else v_event.hours end
  )
  on conflict (event_id, user_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        distance_meters = excluded.distance_meters,
        accuracy_meters = excluded.accuracy_meters,
        flagged_suspicious = excluded.flagged_suspicious,
        flag_reason = excluded.flag_reason,
        checked_in_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

drop function if exists check_in(uuid, double precision, double precision);
grant execute on function check_in(uuid, double precision, double precision, double precision) to authenticated;

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

-- Four rooms share this table, split by `channel`:
--   all    — everyone: pledges, actives, exec
--   active — every non-pledge brother
--   exec   — exec officers (and admins) only
--   pledge — pledges, the pledge committee, and admins
-- `create table if not exists` is a no-op on the live table, so the new
-- columns need explicit ALTERs.
alter table messages add column if not exists channel text not null default 'active';
alter table messages drop constraint if exists messages_channel_check;
alter table messages add constraint messages_channel_check
  check (channel in ('all', 'active', 'exec', 'pledge'));
alter table messages add column if not exists file_path text;
alter table messages add column if not exists file_name text;
-- Original check required 1+ chars; a message that is only an attachment
-- has no text.
alter table messages drop constraint if exists messages_content_check;
alter table messages add constraint messages_content_check
  check (char_length(trim(content)) <= 2000 and (char_length(trim(content)) >= 1 or file_path is not null));

alter table messages enable row level security;

-- Who may READ a channel. Posting rules are separate (send_message below).
create or replace function can_read_channel(p_channel text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select case
    when is_admin() then true
    when p_channel = 'all' then exists (select 1 from profiles where id = auth.uid())
    when p_channel = 'exec' then coalesce((select is_exec from profiles where id = auth.uid()), false)
    when p_channel = 'pledge' then coalesce(
      (select is_pledge or on_pledge_committee from profiles where id = auth.uid()), false)
    else not coalesce((select is_pledge from profiles where id = auth.uid()), true)
  end;
$$;

drop policy if exists "messages are viewable by any signed-in member" on messages;
drop policy if exists "messages are viewable by members of their channel" on messages;
create policy "messages are viewable by members of their channel"
  on messages for select
  to authenticated
  using (can_read_channel(channel));

drop policy if exists "members can delete their own messages, admins any" on messages;
create policy "members can delete their own messages, admins any"
  on messages for delete
  to authenticated
  using (auth.uid() = user_id or is_admin());

drop function if exists send_message(text);

create or replace function send_message(
  p_content text,
  p_channel text default 'active',
  p_file_path text default null,
  p_file_name text default null
)
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

  if not can_read_channel(p_channel) then
    raise exception 'You are not in this chat';
  end if;

  -- Attachments are uploaded by the browser straight to Storage under the
  -- sender's own folder; refuse a path pointing at someone else's file.
  if p_file_path is not null and split_part(p_file_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid attachment';
  end if;

  insert into messages (user_id, content, channel, file_path, file_name)
  values (auth.uid(), trim(coalesce(p_content, '')), p_channel, p_file_path, p_file_name)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function send_message(text, text, text, text) to authenticated;

-- Chat attachments: private bucket, files live under <uploader id>/. A file
-- is readable only if a message the reader can see points at it (messages
-- RLS applies inside the subquery), so a pledge-chat document can't be
-- opened by someone outside that chat.
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', false)
on conflict (id) do nothing;

drop policy if exists "chat-files: members upload to their own folder" on storage.objects;
create policy "chat-files: members upload to their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "chat-files: read files attached to visible messages" on storage.objects;
create policy "chat-files: read files attached to visible messages"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-files'
    and exists (select 1 from public.messages m where m.file_path = storage.objects.name)
  );

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
drop policy if exists "reactions are viewable if the message is" on message_reactions;
create policy "reactions are viewable if the message is"
  on message_reactions for select
  to authenticated
  using (exists (select 1 from messages m where m.id = message_id));

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

  -- security definer skips RLS, so re-check the caller can see the message.
  if not exists (
    select 1 from messages m where m.id = p_message_id and can_read_channel(m.channel)
  ) then
    raise exception 'Message not found';
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

-- `category` splits the full chapter's notes from exec-only ones (admins
-- only); `folder` is free-text grouping (Rush, Finance, Philanthropy...).
alter table chapter_notes add column if not exists category text not null default 'chapter';
alter table chapter_notes drop constraint if exists chapter_notes_category_check;
alter table chapter_notes add constraint chapter_notes_category_check
  check (category in ('chapter', 'exec'));
alter table chapter_notes add column if not exists folder text not null default '';

alter table chapter_notes enable row level security;

drop policy if exists "chapter notes are viewable by any signed-in member" on chapter_notes;
drop policy if exists "chapter notes visible; exec notes only to admins" on chapter_notes;
create policy "chapter notes visible; exec notes only to admins"
  on chapter_notes for select
  to authenticated
  using (category <> 'exec' or is_admin());

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

alter table chapter_files add column if not exists category text not null default 'chapter';
alter table chapter_files drop constraint if exists chapter_files_category_check;
alter table chapter_files add constraint chapter_files_category_check
  check (category in ('chapter', 'exec'));
alter table chapter_files add column if not exists folder text not null default '';
-- A Google Drive (or any) link instead of an uploaded file; storage_path is
-- then ''. Real two-way Drive sync needs a Google Cloud OAuth app, which
-- this project doesn't have - links are the stand-in.
alter table chapter_files add column if not exists external_url text;

alter table chapter_files enable row level security;

drop policy if exists "chapter files are viewable by any signed-in member" on chapter_files;
drop policy if exists "chapter files visible; exec files only to admins" on chapter_files;
create policy "chapter files visible; exec files only to admins"
  on chapter_files for select
  to authenticated
  using (category <> 'exec' or is_admin());

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

-- Breadcrumb trail for the House Presence map. One row per meaningful
-- movement (see record_presence) rather than per ping, and pruned after 30
-- days. Members see only their own trail; admins see everyone's — this is
-- precise location history, so it is deliberately not chapter-wide.
create table if not exists member_locations (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  recorded_at timestamptz not null default now()
);

create index if not exists member_locations_user_time
  on member_locations (user_id, recorded_at desc);

alter table member_locations enable row level security;

drop policy if exists "members see their own trail, admins see all" on member_locations;
create policy "members see their own trail, admins see all"
  on member_locations for select to authenticated
  using (auth.uid() = user_id or is_admin());

-- Outcome of each /api/location request (tokens masked), so "my phone sends
-- nothing" can be diagnosed without access to Vercel's logs. Service role
-- only: RLS on with no policies. The route keeps the newest 300 rows.
create table if not exists location_ping_log (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  outcome text not null,
  detail text not null default ''
);

alter table location_ping_log enable row level security;

-- Per-event time on site, fed by every location ping (browser or the
-- always-on tracker app, see record_presence below). minutes_on_site only
-- grows across pings that are close together, so leaving for two hours and
-- coming back doesn't count the gap. Philanthropy events turn this into
-- house points: 1 point per full hour on site.
create table if not exists event_presence (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  minutes_on_site numeric not null default 0,
  primary key (event_id, user_id)
);

alter table event_presence enable row level security;

drop policy if exists "members see their own presence, admins see all" on event_presence;
create policy "members see their own presence, admins see all"
  on event_presence for select to authenticated
  using (auth.uid() = user_id or is_admin());

-- Single place the house geofence and per-event time-on-site are computed,
-- for an explicit user id: auth.uid() isn't available when the always-on
-- tracker posts to /api/location (that route authenticates by a per-member
-- token and calls this with the service role). Not callable by clients —
-- log_presence_ping() below is the signed-in wrapper.
create or replace function record_presence(
  p_user uuid,
  p_lat double precision,
  p_lng double precision
)
returns house_presence_sessions
language plpgsql
security definer set search_path = public
as $$
declare
  house_lat constant double precision := 39.1639078;
  house_lng constant double precision := -86.5255585;
  house_radius constant double precision := 150;
  -- Pings further apart than this are treated as a gap, not continuous time.
  max_gap constant interval := interval '15 minutes';
  v_within boolean;
  v_row house_presence_sessions;
  v_last member_locations;
begin
  v_within := haversine_meters(p_lat, p_lng, house_lat, house_lng) <= house_radius;

  -- Trail point: only when they've moved ~25 m or it's been 5 min, so a
  -- phone sitting on a desk doesn't write a row every ping.
  select * into v_last from member_locations
  where user_id = p_user order by recorded_at desc limit 1;

  if v_last.id is null
     or now() - v_last.recorded_at > interval '5 minutes'
     or haversine_meters(p_lat, p_lng, v_last.latitude, v_last.longitude) > 25 then
    insert into member_locations (user_id, latitude, longitude) values (p_user, p_lat, p_lng);
    delete from member_locations
    where user_id = p_user and recorded_at < now() - interval '30 days';
  end if;

  select * into v_row from house_presence_sessions
  where user_id = p_user and ended_at is null;

  if v_within then
    if v_row.id is null then
      insert into house_presence_sessions (user_id, started_at, last_ping_at, source)
      values (p_user, now(), now(), 'auto')
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

  insert into event_presence (event_id, user_id)
  select e.id, p_user
  from events e
  where now() between e.starts_at and e.ends_at
    and haversine_meters(p_lat, p_lng, e.latitude, e.longitude) <= e.radius_meters
  on conflict (event_id, user_id) do update
    set minutes_on_site = event_presence.minutes_on_site + case
          when now() - event_presence.last_seen_at <= max_gap
          then extract(epoch from (now() - event_presence.last_seen_at)) / 60.0
          else 0 end,
        last_seen_at = now();

  return v_row;
end;
$$;

revoke execute on function record_presence(uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function record_presence(uuid, double precision, double precision) to service_role;

create or replace function log_presence_ping(p_lat double precision, p_lng double precision)
returns house_presence_sessions
language plpgsql
security definer set search_path = public
as $$
begin
  return record_presence(auth.uid(), p_lat, p_lng);
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

-- Per-member secret for the always-on location tracker (Traccar Client /
-- OwnTracks on the brother's phone posts to /api/location with it). Kept
-- out of `profiles` on purpose: every profile column is readable by every
-- member, and this token lets whoever holds it report that member's
-- location.
create table if not exists location_tokens (
  user_id uuid primary key references profiles (id) on delete cascade,
  token uuid not null unique default gen_random_uuid()
);

alter table location_tokens enable row level security;

drop policy if exists "members see only their own location token" on location_tokens;
create policy "members see only their own location token"
  on location_tokens for select to authenticated
  using (auth.uid() = user_id);

create or replace function get_or_create_location_token()
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_token uuid;
begin
  insert into location_tokens (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  select token into v_token from location_tokens where user_id = auth.uid();
  return v_token;
end;
$$;

-- For when a phone is lost or the token leaks: old token stops working.
create or replace function rotate_location_token()
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_token uuid := gen_random_uuid();
begin
  insert into location_tokens (user_id, token) values (auth.uid(), v_token)
  on conflict (user_id) do update set token = excluded.token;
  return v_token;
end;
$$;

grant execute on function get_or_create_location_token() to authenticated;
grant execute on function rotate_location_token() to authenticated;

-- Calendar reminders. Each member picks which lead times they want
-- (15 min / 1 hour / 1 day before an event) and registers their devices
-- for web push; /api/cron/reminders sends them. reminder_log makes a send
-- idempotent so a late or repeated cron run can't double-notify.
create table if not exists notification_prefs (
  user_id uuid primary key references profiles (id) on delete cascade,
  remind_15m boolean not null default false,
  remind_1h boolean not null default false,
  remind_1d boolean not null default false,
  push_subscriptions jsonb not null default '[]'::jsonb
);

alter table notification_prefs enable row level security;

drop policy if exists "members manage only their own notification prefs" on notification_prefs;
create policy "members manage only their own notification prefs"
  on notification_prefs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists reminder_log (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  lead_minutes integer not null,
  sent_at timestamptz not null default now(),
  primary key (event_id, user_id, lead_minutes)
);

-- RLS on with no policies: only the service role (the cron route) touches it.
alter table reminder_log enable row level security;

-- ============================================================
-- Events tab expansion: house points, reference files, RSVP, excuses,
-- feedback survey, and check-out.
-- ============================================================

-- Distinct from `hours` (philanthropy service hours): house points are the
-- chapter's own points system. 0 = not worth points.
alter table events add column if not exists house_points integer not null default 0;

alter table checkins add column if not exists checked_out_at timestamptz;
alter table checkins add column if not exists checkout_latitude double precision;
alter table checkins add column if not exists checkout_longitude double precision;

-- Check-out. For philanthropy events it is held to the same standard as
-- check-in — you must be within the event's radius with a real GPS fix — so
-- hours can't be banked by tapping "check out" from home, and the hours
-- credited are the time actually spent from check-in to check-out (floored
-- to quarter hours, never past the event's end, capped at the event's
-- `hours` when it sets one). For other event types it only records when and
-- where you left and never rejects.
create or replace function check_out(
  p_event_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null
)
returns checkins
language plpgsql
security definer set search_path = public
as $$
declare
  v_max_accuracy_meters constant double precision := 100;
  v_event events;
  v_checkin checkins;
  v_distance double precision;
  v_end timestamptz;
  v_hours numeric;
  v_row checkins;
begin
  select * into v_event from events where id = p_event_id;
  if v_event is null then
    raise exception 'Event not found';
  end if;

  select * into v_checkin from checkins
  where event_id = p_event_id and user_id = auth.uid() and checked_out_at is null;
  if v_checkin.id is null then
    raise exception 'You are not checked in to this event (or already checked out)';
  end if;

  v_hours := v_checkin.hours_earned;

  if v_event.category = 'philanthropy' then
    if p_accuracy is not null and p_accuracy > v_max_accuracy_meters then
      raise exception 'Your location signal is too weak (± % m) to check out — move somewhere with a clearer sky view and try again',
        round(p_accuracy);
    end if;
    if p_accuracy is null then
      raise exception 'Your device did not report a location accuracy — try again';
    end if;

    v_distance := haversine_meters(p_lat, p_lng, v_event.latitude, v_event.longitude);
    if v_distance > v_event.radius_meters then
      raise exception 'You are % meters away — you must be within % meters of the event to check out',
        round(v_distance), v_event.radius_meters;
    end if;

    v_end := least(now(), v_event.ends_at);
    v_hours := floor(greatest(0, extract(epoch from (v_end - v_checkin.checked_in_at))) / 900) / 4.0;
    if v_event.hours > 0 then
      v_hours := least(v_hours, v_event.hours);
    end if;
  end if;

  update checkins
  set checked_out_at = now(),
      checkout_latitude = p_lat,
      checkout_longitude = p_lng,
      hours_earned = v_hours
  where id = v_checkin.id
  returning * into v_row;

  return v_row;
end;
$$;

drop function if exists check_out(uuid, double precision, double precision);
grant execute on function check_out(uuid, double precision, double precision, double precision) to authenticated;

-- Reference files/docs per event. Bytes live in the existing private
-- "chapter-files" bucket under an events/ prefix, so its admin-only upload
-- policy already covers them.
create table if not exists event_files (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  title text not null,
  storage_path text not null,
  uploaded_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

alter table event_files enable row level security;

drop policy if exists "event files are viewable by any signed-in member" on event_files;
create policy "event files are viewable by any signed-in member"
  on event_files for select to authenticated using (true);

drop policy if exists "only admins can manage event files" on event_files;
create policy "only admins can manage event files"
  on event_files for all to authenticated
  using (is_admin()) with check (is_admin());

-- RSVPs: no computed business rule, so plain own-row RLS is enough here
-- (unlike checkins). Everyone can read so the card can show head-counts.
create table if not exists event_rsvps (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'not_going')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table event_rsvps enable row level security;

drop policy if exists "rsvps are viewable by any signed-in member" on event_rsvps;
create policy "rsvps are viewable by any signed-in member"
  on event_rsvps for select to authenticated using (true);

drop policy if exists "members manage their own rsvp" on event_rsvps;
create policy "members manage their own rsvp"
  on event_rsvps for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Excuse requests. Members may only INSERT a pending row for themselves;
-- only admins can UPDATE (approve/deny), so a member can't approve their
-- own excuse by writing to the table directly.
create table if not exists event_excuses (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table event_excuses enable row level security;

drop policy if exists "members see their own excuses, admins see all" on event_excuses;
create policy "members see their own excuses, admins see all"
  on event_excuses for select to authenticated
  using (auth.uid() = user_id or is_admin());

drop policy if exists "members submit their own pending excuse" on event_excuses;
create policy "members submit their own pending excuse"
  on event_excuses for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "members withdraw their own pending excuse" on event_excuses;
create policy "members withdraw their own pending excuse"
  on event_excuses for delete to authenticated
  using ((auth.uid() = user_id and status = 'pending') or is_admin());

drop policy if exists "only admins can review excuses" on event_excuses;
create policy "only admins can review excuses"
  on event_excuses for update to authenticated
  using (is_admin()) with check (is_admin());

-- Post-event feedback survey. Readable only by the author and admins so
-- brothers can be candid.
create table if not exists event_feedback (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comments text not null default '',
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table event_feedback enable row level security;

drop policy if exists "members see their own feedback, admins see all" on event_feedback;
create policy "members see their own feedback, admins see all"
  on event_feedback for select to authenticated
  using (auth.uid() = user_id or is_admin());

drop policy if exists "members submit and edit their own feedback" on event_feedback;
create policy "members submit and edit their own feedback"
  on event_feedback for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Designated sober brothers for a social event or party. No row = nobody
-- designated. Everyone can see who they are (that's the point); only
-- calendar editors assign them.
create table if not exists event_sober_brothers (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  primary key (event_id, user_id)
);

alter table event_sober_brothers enable row level security;

drop policy if exists "sober brothers are viewable by any signed-in member" on event_sober_brothers;
create policy "sober brothers are viewable by any signed-in member"
  on event_sober_brothers for select to authenticated using (true);

drop policy if exists "calendar editors manage sober brothers" on event_sober_brothers;
create policy "calendar editors manage sober brothers"
  on event_sober_brothers for all to authenticated
  using (can_edit_calendar()) with check (can_edit_calendar());

-- RSVP-required events with an optional deadline. `create table if not exists`
-- never touches the live events table, hence the explicit ALTERs.
alter table events add column if not exists rsvp_required boolean not null default false;
alter table events add column if not exists rsvp_deadline timestamptz;

-- The "members manage their own rsvp" policy can't see the deadline, so a
-- trigger refuses new/changed RSVPs once it has passed (admins may still
-- fix one on someone's behalf).
create or replace function enforce_rsvp_deadline()
returns trigger
language plpgsql
as $$
declare
  deadline timestamptz;
begin
  select rsvp_deadline into deadline from events where id = new.event_id;
  if deadline is not null and now() > deadline and not is_admin() then
    raise exception 'The RSVP deadline for this event has passed';
  end if;
  return new;
end;
$$;

drop trigger if exists event_rsvps_deadline on event_rsvps;
create trigger event_rsvps_deadline
  before insert or update on event_rsvps
  for each row execute function enforce_rsvp_deadline();

-- Brothers assigned to (expected at) an event. No row = nobody assigned.
-- Everyone can see who is assigned; only calendar editors set it.
create table if not exists event_assignments (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  primary key (event_id, user_id)
);

alter table event_assignments enable row level security;

drop policy if exists "assignments are viewable by any signed-in member" on event_assignments;
create policy "assignments are viewable by any signed-in member"
  on event_assignments for select to authenticated using (true);

drop policy if exists "calendar editors manage assignments" on event_assignments;
create policy "calendar editors manage assignments"
  on event_assignments for all to authenticated
  using (can_edit_calendar()) with check (can_edit_calendar());

-- ============================================================
-- Gallery — photos from parties and socials. Both the full image and a
-- small thumbnail are uploaded by the browser (already resized) to the
-- private `gallery` bucket under <uploader id>/. Any member may add; an
-- uploader (or an admin) may remove.
-- ============================================================
create table if not exists gallery_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  event_id uuid references events (id) on delete set null,
  album text not null default '',
  storage_path text not null,
  thumb_path text not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

alter table gallery_photos enable row level security;

drop policy if exists "gallery photos are viewable by any signed-in member" on gallery_photos;
create policy "gallery photos are viewable by any signed-in member"
  on gallery_photos for select to authenticated using (true);

drop policy if exists "members add photos under their own folder" on gallery_photos;
create policy "members add photos under their own folder"
  on gallery_photos for insert to authenticated
  with check (
    user_id = auth.uid()
    and split_part(storage_path, '/', 1) = auth.uid()::text
    and split_part(thumb_path, '/', 1) = auth.uid()::text
  );

drop policy if exists "uploaders and admins delete photos" on gallery_photos;
create policy "uploaders and admins delete photos"
  on gallery_photos for delete to authenticated
  using (user_id = auth.uid() or is_admin());

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', false)
on conflict (id) do nothing;

drop policy if exists "gallery: members upload to their own folder" on storage.objects;
create policy "gallery: members upload to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "gallery: members read" on storage.objects;
create policy "gallery: members read"
  on storage.objects for select to authenticated
  using (bucket_id = 'gallery');

drop policy if exists "gallery: uploaders and admins delete" on storage.objects;
create policy "gallery: uploaders and admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ============================================================
-- Dues — one row per member per charge. Members see only their own; admins
-- (the treasurer) see and manage everyone's. `batch_id` groups the rows
-- created together so the admin screen can show one charge with N members.
-- Payment is recorded by hand (paid_at) — there is no payment processing.
-- ============================================================
create table if not exists dues_charges (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  paid_at timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table dues_charges enable row level security;

drop policy if exists "members see their own dues, admins see all" on dues_charges;
create policy "members see their own dues, admins see all"
  on dues_charges for select to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists "admins manage dues" on dues_charges;
create policy "admins manage dues"
  on dues_charges for all to authenticated
  using (is_admin()) with check (is_admin());

-- Which reminder stages have already been pushed (cron route, service role).
create table if not exists dues_reminder_log (
  charge_id uuid not null references dues_charges (id) on delete cascade,
  stage text not null,
  sent_at timestamptz not null default now(),
  primary key (charge_id, stage)
);
alter table dues_reminder_log enable row level security;

-- ============================================================
-- Course grades — self-reported by pledges. (A Canvas token integration was
-- built first, but IU stopped offering user-level Canvas API tokens in Aug
-- 2026, so grades are typed in instead.) A pledge manages only their own
-- rows; the pledge committee and admins can read pledges' rows.
-- ============================================================
drop table if exists canvas_grades;
drop table if exists canvas_connections;

create table if not exists course_grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  course_name text not null check (char_length(trim(course_name)) between 1 and 80),
  score numeric(5, 2) not null check (score >= 0 and score <= 150),
  updated_at timestamptz not null default now(),
  unique (user_id, course_name)
);

alter table course_grades enable row level security;

drop policy if exists "own grades, or pledge grades for the committee" on course_grades;
create policy "own grades, or pledge grades for the committee"
  on course_grades for select to authenticated
  using (
    user_id = auth.uid()
    or (
      on_pledge_committee()
      and exists (select 1 from profiles p where p.id = course_grades.user_id and p.is_pledge)
    )
  );

drop policy if exists "members manage their own grades" on course_grades;
create policy "members manage their own grades"
  on course_grades for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- Polls — created by exec/admins. A poll marked `required` blocks the rest of
-- the app (dashboard layout) for everyone in its audience until they answer.
-- Votes are written only through submit_poll_vote(), which enforces audience,
-- open/closed, single vs multiple choice, and one submission per member.
-- Anonymous polls: votes are only readable by the voter; everyone else (exec
-- included) sees counts via poll_counts().
-- ============================================================
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(trim(question)) between 1 and 300),
  options jsonb not null,
  allow_multiple boolean not null default false,
  anonymous boolean not null default true,
  required boolean not null default false,
  audience text not null default 'everyone'
    check (audience in ('everyone', 'actives', 'pledges', 'exec')),
  closes_at timestamptz,
  closed boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table polls enable row level security;

create or replace function poll_in_audience(p_audience text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select case p_audience
    when 'everyone' then exists (select 1 from profiles where id = auth.uid())
    when 'actives' then coalesce((select not is_pledge from profiles where id = auth.uid()), false)
    when 'pledges' then coalesce((select is_pledge from profiles where id = auth.uid()), false)
    when 'exec' then is_exec()
    else false
  end;
$$;

drop policy if exists "polls visible to their audience and exec" on polls;
create policy "polls visible to their audience and exec"
  on polls for select to authenticated
  using (poll_in_audience(audience) or is_exec());

drop policy if exists "exec manage polls" on polls;
create policy "exec manage polls"
  on polls for all to authenticated
  using (is_exec()) with check (is_exec());

create table if not exists poll_votes (
  poll_id uuid not null references polls (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  option_index integer not null check (option_index >= 0),
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id, option_index)
);

alter table poll_votes enable row level security;

drop policy if exists "votes: own, or exec on non-anonymous polls" on poll_votes;
create policy "votes: own, or exec on non-anonymous polls"
  on poll_votes for select to authenticated
  using (
    user_id = auth.uid()
    or (is_exec() and exists (select 1 from polls p where p.id = poll_id and not p.anonymous))
  );

create or replace function submit_poll_vote(p_poll_id uuid, p_options integer[])
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_poll polls;
  v_count integer;
  v_opt integer;
begin
  select * into v_poll from polls where id = p_poll_id;
  if not found or not poll_in_audience(v_poll.audience) then
    raise exception 'Poll not found';
  end if;
  if v_poll.closed or (v_poll.closes_at is not null and v_poll.closes_at <= now()) then
    raise exception 'This poll is closed';
  end if;
  if exists (select 1 from poll_votes where poll_id = p_poll_id and user_id = auth.uid()) then
    raise exception 'You already answered this poll';
  end if;

  v_count := coalesce(array_length(p_options, 1), 0);
  if v_count = 0 then
    raise exception 'Choose an answer';
  end if;
  if not v_poll.allow_multiple and v_count > 1 then
    raise exception 'Choose only one answer';
  end if;

  foreach v_opt in array p_options loop
    if v_opt < 0 or v_opt >= jsonb_array_length(v_poll.options) then
      raise exception 'Invalid answer';
    end if;
  end loop;

  insert into poll_votes (poll_id, user_id, option_index)
  select p_poll_id, auth.uid(), distinct_opt from unnest(p_options) as distinct_opt
  group by distinct_opt;
end;
$$;

grant execute on function submit_poll_vote(uuid, integer[]) to authenticated;

-- Per-option counts, plus option_index = -1 holding the number of people who
-- answered. Returns nothing unless the caller is exec, has answered, or the
-- poll is over — so results can't be peeked at before voting.
create or replace function poll_counts(p_poll_id uuid)
returns table (option_index integer, votes bigint)
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_poll polls;
begin
  select * into v_poll from polls where id = p_poll_id;
  if not found then return; end if;
  if not (
    is_exec()
    or exists (select 1 from poll_votes where poll_id = p_poll_id and user_id = auth.uid())
    or (poll_in_audience(v_poll.audience)
        and (v_poll.closed or (v_poll.closes_at is not null and v_poll.closes_at <= now())))
  ) then
    return;
  end if;

  return query
    select pv.option_index, count(*)::bigint from poll_votes pv
    where pv.poll_id = p_poll_id group by pv.option_index
    union all
    select -1, count(distinct pv.user_id)::bigint from poll_votes pv where pv.poll_id = p_poll_id;
end;
$$;

grant execute on function poll_counts(uuid) to authenticated;

-- ============================================================
-- Bootstrap the first admin. Run this SEPARATELY, once, after you've
-- signed up in the app yourself — replace the email below with yours.
-- Every future admin promotion after this one can be done the same
-- way, by whoever currently holds admin, from the Supabase dashboard's
-- Table Editor (no code/redeploy needed — this IS the transfer mechanism).
-- ============================================================
-- update profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'you@example.com');
