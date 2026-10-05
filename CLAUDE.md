# Acacia

Chapter attendance, involvement, and chat tracker for a real Acacia Fraternity
chapter (Indiana University Bloomington, IU-Bloomington chapter). Themed on
Acacia Fraternity's actual national brand — see [BRAND.md](BRAND.md) for the
full research (colors, typography, logo/crest usage rules) sourced from
acacia.org and their official 2019 Brand Guide, not guessed.

Single chapter, single deployment. Not a multi-tenant product — every table,
every RLS policy, every constant (chapter house coordinates, etc.) assumes
exactly one chapter using exactly one Supabase project.

## Commands

| | |
|---|---|
| `npm run dev` | Local dev server at localhost:3000 |
| `npm run build` | Production build (runs TypeScript + bundling) |
| `npm run lint` | ESLint — gate this before considering any change done |

There is no test suite. Verification means running `npm run dev` and actually
clicking through the flow, or `npm run build` to catch type errors. A clean
build proves the code compiles, not that a feature works — always check the
real behavior (sign in, check in, post a chat message, etc.) before calling
something done.

## Architecture

```
supabase/schema.sql              THE schema — every table, RLS policy, and
                                  Postgres function. Idempotent (safe to
                                  paste and re-run in full at any time) via
                                  IF NOT EXISTS / OR REPLACE / explicit
                                  ALTER TABLE ADD COLUMN IF NOT EXISTS for
                                  columns added to tables that already
                                  existed live — see "Adding a DB column"
                                  below, this bit once already.
supabase/seed-acacia-calendar.sql  One-time seed of real chapter events
                                  scraped from the user's personal Google
                                  Calendar. Not idempotent in the same way
                                  as schema.sql — re-running it duplicates
                                  events. created_by resolves to "whoever
                                  is currently admin" via a cross join, so
                                  it never needed a placeholder UUID.
src/lib/supabase/client.ts       Browser Supabase client (anon/publishable
                                  key — safe to expose)
src/lib/supabase/server.ts       Server Component / Server Action Supabase
                                  client (still anon key — respects RLS)
src/lib/supabase/admin.ts        SERVICE ROLE client — bypasses all RLS.
                                  Only ever imported by
                                  dashboard/admin/actions.ts's createMember.
                                  Never import this from anything that
                                  ships to the browser.
src/lib/types.ts                 Every table's row shape, hand-kept in
                                  sync with schema.sql (no codegen)
src/lib/event-status.ts          eventStatus() — upcoming/open/closed from
                                  starts_at/ends_at
src/lib/event-category.ts        EVENT_CATEGORIES, categoryLabel(),
                                  categoryBadgeClass()
src/lib/geocode.ts                Server Action wrapping OpenStreetMap's
                                  free Nominatim API — turns a typed
                                  address into lat/lng for event creation
src/lib/house-location.ts        The real chapter house's coordinates —
                                  single source of truth for the display
                                  side; the actual geofence check is
                                  hardcoded again inside
                                  log_presence_ping() in schema.sql (keep
                                  both in sync if the house ever changes)
middleware.ts                    Redirects signed-out users to /login,
                                  signed-in users away from /login.
                                  PUBLIC_PATHS also covers
                                  /forgot-password and /reset-password.
src/app/login, /forgot-password, /reset-password   Auth pages. No public
                                  sign-up — see "No public sign-up" below.
src/app/dashboard/layout.tsx     Mounts DashboardSidebar + PresenceTracker
                                  for every authenticated page
src/app/dashboard/page.tsx       Home — "Hello, brother {first name}",
                                  personal to-do list, upcoming events
src/app/dashboard/events         The full events list (separate from Home)
src/app/dashboard/calendar       Month-grid calendar, click a day to see
                                  its events
src/app/dashboard/chat           Realtime chapter-wide chat
src/app/dashboard/chapter        Meeting notes + Supabase Storage-backed
                                  file uploads
src/app/dashboard/parking        Self-service parking spot/plate directory
src/app/dashboard/house-presence Live-in/live-out status + hours-at-the-
                                  house tracking (see its own section below)
src/app/dashboard/personalization  Theme (light/dark/system) + home-screen
                                  icon choice
src/app/dashboard/admin          Event list with attendance counts,
                                  member permissions, Add Member form
src/components/dashboard-sidebar.tsx  Hover-to-expand left nav — see
                                  "Sidebar" below
src/components/presence-tracker.tsx   Invisible, mounted globally —
                                  pings GPS every ~3 min while the app is
                                  open (see "House Presence" below)
```

## Database schema (supabase/schema.sql)

Tables, in dependency order: `profiles` → `events` → `checkins`,
`messages` → `message_reactions`, `chapter_notes`, `chapter_files` (+ the
`chapter-files` Storage bucket), `parking_spots`, `tasks`,
`house_presence_sessions`.

**The recurring security pattern, used everywhere a permission actually
matters:** the table itself has **no direct INSERT/UPDATE policy** for
regular users. The only way to write is through a `security definer`
Postgres function (`check_in()`, `send_message()`, `toggle_reaction()`,
`log_presence_ping()`, `log_presence_leave()`) that validates the real
constraint — GPS distance, `can_chat`/`can_react`, whatever — **before**
writing anything. This is deliberate: RLS policies alone can't express "you
may insert a row, but only if this computed condition holds and only with
these exact derived values" — a policy can gate row visibility/ownership,
but the actual business rule (distance ≤ radius, permission flag is true)
needs real logic, which only a function can run. Never add a plain
INSERT/UPDATE policy to `checkins`, `messages`, `message_reactions`, or
`house_presence_sessions` — that would let someone bypass the check by
calling the table directly from the browser console.

**`profiles.role`/`can_chat`/`can_react` privilege-escalation fix**: the
`update` policy on `profiles` allows `auth.uid() = id OR is_admin()` with
no column restriction — because **Postgres RLS restricts which ROWS a
policy allows, not which COLUMNS**. Without the
`prevent_self_privilege_escalation` trigger, any signed-in member could run
`update profiles set role = 'admin' where id = auth.uid()` themselves. The
trigger is the actual enforcement; nothing in the UI is what's stopping
this.

**Snapshot-at-write-time pattern**: `checkins.distance_meters` and
`checkins.hours_earned` are copied from the event at the moment of
check-in, not read live from `events` later. Same for
`house_presence_sessions`. This means editing an event's `hours` value
later does not retroactively change what someone already earned —
deliberate, matches how a real philanthropy-hours record should behave.

## Adding a DB column

**`create table if not exists` does nothing to a table that already
exists.** This already bit the `events.category` column and
`profiles.lives_in_house` once — both were added to the `create table`
block in schema.sql, which is a no-op against the live database, so an
explicit `alter table ... add column if not exists ...` had to be added
right after. If you add a column to any table in this schema, always pair
it with an explicit `ALTER TABLE ADD COLUMN IF NOT EXISTS`, or it will
silently not exist on re-run against the live database — the failure mode
is a confusing "column does not exist" error the first time a real INSERT
tries to use it, not an error when schema.sql itself runs.

## Running SQL against the live database

**Preferred: `npm run db:push`.** `scripts/db-push.mjs` opens a raw
Postgres connection (via `pg`, using `SUPABASE_DB_URL` from `.env.local` —
see `.env.local.example`) and runs `supabase/schema.sql` directly, wrapped
in a transaction (rolls back cleanly on any error). This never touches the
dashboard's SQL Editor at all, so the Monaco corruption issue below simply
doesn't apply — it isn't a safer way of typing into that editor, it's a
different code path entirely (a direct wire-protocol connection to the
same database the SQL Editor itself talks to).

Two live gotchas hit setting this up, both already fixed in
`scripts/db-push.mjs` — worth knowing if `SUPABASE_DB_URL` ever needs to
be regenerated (e.g. after a password reset):
- **`SUPABASE_DB_URL` must be the session pooler string, not "Direct
  connection."** `db.<ref>.supabase.co` (the Direct connection host) now
  resolves to an IPv6 address only — confirmed via `nslookup` — and this
  network can't route to it, failing with `getaddrinfo ENOENT`. The
  pooler host (`aws-0-<region>.pooler.supabase.com:5432`, username
  `postgres.<project-ref>` instead of plain `postgres`) resolves over
  IPv4 and works. Get it from the dashboard's "Connect" button → the
  Direct panel's mode dropdown → Session pooler.
- **TLS verification needs Supabase's own root CA.** Supabase signs
  Postgres/pooler certs with a private CA ("Supabase Root 2021 CA"), not
  a publicly-trusted one — Node's bundled CA bundle doesn't include it,
  so plain `ssl: true` fails with `SELF_SIGNED_CERT_IN_CHAIN`. This
  isn't a MITM/proxy issue (verified with `openssl s_client -showcerts`:
  it's a real, correctly self-signed root, exactly what a root CA is
  supposed to be) — the fix is handing that CA to `pg` explicitly, not
  `rejectUnauthorized: false`. The cert is saved at
  `scripts/supabase-root-ca.pem` (public info, safe to commit — it's a
  verification anchor, not a secret) and `db-push.mjs` loads it into
  `ssl: { ca }`, so this still gets genuine full certificate
  verification.

**Do not try to paste large SQL into Supabase's SQL Editor via simulated
browser keystrokes — it will corrupt the content.** Confirmed live,
repeatedly: Monaco (the SQL Editor's code editor) auto-indents and
auto-closes brackets on every keystroke, and synthetic `type`-action input
compounds indentation line-by-line and merges/drops lines outright.
Clipboard-write-then-paste via JS also fails for large payloads (CDP
`Runtime.evaluate` times out around 30-45s for big strings). If
`db:push` isn't available for some reason (e.g. `SUPABASE_DB_URL` isn't
set yet), the fallback is: have the user open the real `.sql` file
directly in Notepad (it's a real file on disk, not something that needs
to be "found" or downloaded), `Ctrl+A` → `Ctrl+C` there, then `Ctrl+V`
into the SQL Editor. A genuine OS-level clipboard paste is inserted as
one bulk operation and doesn't trigger Monaco's per-keystroke
autocomplete/indent logic; typing (even via automation) does. The same
caution applies to any other code-editor-style web input (e.g. Vercel's
environment-variable "paste .env contents" field silently mis-parsed a
two-line paste when done via simulated typing instead of a real paste).

## Brand (src/components/acacia-*, public/brand/)

Full research in [BRAND.md](BRAND.md). Two real, official Acacia Fraternity
marks are used, both downloaded directly from acacia.org (never
recreated — their own graphics standards explicitly forbid redrawing
letterforms):
- **The "A" mark** (`acacia-logo-black.svg`/`-white.svg`) — used as the
  login/nav badge and the browser favicon (`src/app/icon.svg`, `src/app/
  icon-mark/route.tsx`).
- **The crest/coat of arms** (`public/brand/crest-transparent.png`) — used
  top-left in the sidebar. The official file only ever ships on a solid
  white background; `crest-transparent.png` is a **derived asset**,
  chroma-keyed to real alpha transparency by a one-off `sharp` script (not
  committed — regenerate by reading near-white pixels to alpha 0, see git
  history commit "Full-color transparent crest..." for the exact
  algorithm) rather than faking transparency with a CSS blend-mode trick,
  which would have darkened/desaturated the actual gold/green/blue against
  the dark sidebar.

Archivo (Google Fonts, free) substitutes for Acacia's real typeface
(Founders Grotesk — commercial, can't be embedded). Brand colors
(`acacia-black` `#1E1E1E`, `acacia-gold` `#F9E547`, `acacia-green`
`#008675`, `acacia-blue` `#003D4C`) are fixed Tailwind theme colors,
**not** theme-dependent — they don't change between light/dark mode, only
the `surface`/`background`/`muted` tokens do (see Personalization below).

## Personalization (theme)

Stored as a **cookie**, not account data — deliberately device-level,
matching how most apps treat dark mode as a per-device setting:
- `acacia-theme` (light/dark/system) — read server-side in
  `src/app/layout.tsx` to set `data-theme` on `<html>` before first paint
  (no flash). CSS variables swap under an explicit `[data-theme="dark"]`
  selector and a `prefers-color-scheme: dark` media query for "system",
  with explicit light always winning — same contract used for
  theme-aware Artifacts.

There used to be an Acacia-A-vs-crest home-screen icon choice. Removed on
purpose: phones copy the icon when "Add to Home Screen" is tapped and a web
app can never change it afterward (only a native app can). The home-screen and
touch icon is always the A (`src/app/icon-mark/route.tsx`).

## Sidebar (src/components/dashboard-sidebar.tsx)

Rests collapsed to icons, expands on mouse hover (enter/leave), and can be
**pinned** open permanently (persisted to `localStorage` under
`acacia-sidebar-pinned`) via a button that only appears once expanded.
The `pinned` state starts `false` in a `useState` initializer (not read
from `localStorage` directly in the initializer) specifically to avoid a
server/client hydration mismatch — `localStorage` doesn't exist during
SSR, so the real saved value is synced in via a `useEffect` right after
mount instead. That `useEffect`'s `setState` call needed an inline
`eslint-disable-next-line react-hooks/set-state-in-effect` — this project's
ESLint config flags that pattern by default, but reading a browser-only
API genuinely can't happen any earlier than an effect.

## Check-in (events, checkins)

Every event has `latitude`/`longitude`/`radius_meters` (and an optional
`address` field, geocoded via `src/lib/geocode.ts`'s free OpenStreetMap
Nominatim lookup — no Google Maps API key/billing needed for this app's
volume). `check_in()` in schema.sql computes real Haversine distance
between the submitted GPS coordinates and the event's location and
rejects anything beyond `radius_meters`. Events also carry a `category`
(`chapter_meeting`/`social`/`philanthropy`/`other`, shown as a color-coded
badge — see `src/lib/event-category.ts`) and an optional `hours` value —
checking into a philanthropy event with `hours > 0` credits that many
hours to the member's running total (shown on the Events/Home pages and
per-member on the Admin dashboard).

## Chat (messages, message_reactions)

Realtime via Supabase's Postgres change feed (`supabase.channel(...).on(
'postgres_changes', ...)` in `src/components/chat-room.tsx`), not polling.
Sending and reacting are each independently gated by
`profiles.can_chat`/`can_react` — flags an admin controls per member from
the Admin dashboard, separate from `role`. Both flow through the
no-direct-table-write pattern described above.

## House Presence (house_presence_sessions)

**Read the big comment on `house_presence_sessions` in schema.sql before
touching this feature.** The load-bearing constraint: **iOS gives web
apps and PWAs zero background location access, full stop** — not a
permission that can be requested, not something a paid developer account
unlocks. The instant a brother locks their phone or switches apps, all
location access is gone for anything that isn't a native App Store app.
Android is somewhat more flexible but Chrome still aggressively suspends
backgrounded tabs/PWAs. This was discussed explicitly with the user before
building anything — they wanted true 24/7 tracking, and the honest answer
is that requires a **separate native iOS/Android app project** with
"Always Allow" location permission, not something achievable through this
web app regardless of consent/agreements signed.

What's actually built, given that ceiling:
- **Automatic**: `src/components/presence-tracker.tsx`, mounted globally
  in `dashboard/layout.tsx`, pings `log_presence_ping()` with the current
  GPS position every ~3 minutes while the tab is open and
  `document.visibilityState === 'visible'`. Renders nothing, never
  surfaces errors — a missed ping just means that stretch of time isn't
  counted, not a broken app.
- **Manual**: "I'm home"/"I'm leaving" buttons
  (`src/components/presence-toggle.tsx`) on the brother's own row, to
  cover gaps (e.g. overnight, when the app isn't open).
- Both funnel through `log_presence_ping()`/`log_presence_leave()`, which
  verify the caller's coordinates are within 150m of the real chapter
  house (`src/lib/house-location.ts`) before logging anything.
- At most one **open** session per user (`ended_at is null`) is enforced
  by a partial unique index, not application logic.
- Hours shown are approximate by design — the page says so — since
  there's no cron job closing stale sessions (Vercel serverless has no
  persistent background workers, and this app doesn't use Supabase's
  `pg_cron`). A session left open because someone just closed the tab
  without an explicit "I'm leaving" will keep counting until their next
  ping puts them out of range.

## Always-on location, time on site, and reminders

- **Always-on tracking**: web apps get no background location, so brothers
  install a free tracker app (Traccar Client or OwnTracks) that POSTs to
  `src/app/api/location/route.ts`. It authenticates by a per-member token in
  `location_tokens` (separate table on purpose — every `profiles` column is
  readable by every member), then calls `record_presence()` with the service
  role. `record_presence()` is the single place the house geofence and
  per-event `event_presence.minutes_on_site` are computed; `log_presence_ping()`
  is just the signed-in wrapper. Pings more than 15 min apart count as a gap.
  Philanthropy events award 1 house point per full hour on site (computed in
  the Events page, not stored). Needs `SUPABASE_SERVICE_ROLE_KEY`.
- **Reminders**: members pick 15 min / 1 hr / 1 day in Personalization
  (`notification_prefs`) and enable web push per device
  (`public/sw.js`). `/api/cron/reminders` sends due pushes, deduped by
  `reminder_log`. Vercel Hobby crons are daily-only, so
  `.github/workflows/reminders.yml` pings it every 5 min — needs repo secrets
  `APP_URL` + `CRON_SECRET`, and Vercel env vars `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `CRON_SECRET`. iPhone only receives web push once the
  app is added to the Home Screen.
- **Calendar** (`src/components/calendar-view.tsx`) is modeled on Bridge's
  planner: Day/Week/Month, hour grid with overlap columns, multi-day events
  (>= 24h, e.g. pledge period) as bars in an all-day strip.
- `profiles.is_pledge` is admin-only (guarded in the privilege trigger).

## Chat channels, attachments, chapter folders

- `messages.channel`: `active` (non-pledges), `exec` (announcements: only
  admins post, everyone else reads + reacts; admins see "N of M reacted"),
  `pledge` (pledges + admins). Read access is `can_read_channel()` in RLS
  (reactions inherit it via the message); posting rules live in
  `send_message()`. Realtime respects RLS. The web can't block screenshots —
  "pledge chats (no ss)" is not enforceable here.
- Chat documents: private `chat-files` bucket, uploaded by the browser under
  `<uid>/`; a file is readable only if a visible message points at it.
- `chapter_notes`/`chapter_files` have `category` (`chapter` | `exec`, exec is
  admin-only via RLS) and free-text `folder`. Google Drive "sync" is just
  stored links (`external_url`); real sync needs a Google Cloud OAuth app.
- Pages can go full-width by rendering a `data-wide` element (see
  `dashboard/layout.tsx`); the calendar does.

## House Presence map (member_locations)

`record_presence()` also writes a breadcrumb row to `member_locations`
(when someone moves ~25 m or 5 min passes; pruned after 30 days). RLS: a
member sees only their own trail, admins see everyone's — precise location
history is deliberately not chapter-wide. `src/components/house-map.tsx`
draws it with Leaflet + OpenStreetMap tiles (free; an embedded Google Map
can't draw trails without a billed Maps JS API key). It re-fits the view only
when the selected person changes, and the page refreshes every 60 s.
`HOUSE_LOCATION` (702 E 3rd St) is the house marker/geofence circle.

## Calendar editing, timezones, seed data

- `profiles.can_edit_calendar` + `can_edit_calendar()` (true for admins too)
  gate events INSERT/UPDATE/DELETE in RLS, so the chapter president can manage
  the calendar without full admin. Admin-only column (privilege trigger).
  New-event form: `/dashboard/calendar/new` (moved from `/admin/new`).
- **Timezone**: Vercel runs in UTC. Server-rendered times must go through
  `src/lib/chapter-time.ts` (`formatChapterTime`), and typed
  `datetime-local` values through `chapterWallTimeToIso`, or every event is
  off by 4-5 hours. Client components use the browser's own zone.
- `supabase/seed-acacia-calendar.sql` was run against the live DB on
  2026-10-05 (104 events, Sept 7 - Dec 18, scraped Sept 17 from Jack's Google
  Calendar). It is NOT idempotent — don't re-run it on a populated table.
  Changes made in Google Calendar after Sept 17 are not reflected.

## Event types, address search, strict Philo check-in/out

- Types (`events.category`): `chapter_meeting` "Chapter", `philanthropy` "Philo
  event", `social` "Social event", `party`, `general_social`, plus legacy
  `other` (imported calendar default; not offered for new events).
- Address search (`src/lib/geocode.ts`, `location-picker.tsx`): Photon
  (komoot) type-ahead, free/no key, worldwide, biased to Bloomington. Replaced
  Nominatim, whose policy forbids search-as-you-type. The picked result sets
  the event's lat/lng, which is what check-in validates against.
- **Philanthropy is strict**: `check_in()` refuses a second check-in (it would
  reset the start time) and credits 0 hours; `check_out()` requires being
  within the radius with a real GPS accuracy (<= 100 m), then credits hours =
  time from check-in to check-out (quarter-hour floor, not past the event end,
  capped at `events.hours` if set). Other types: check-out just records
  when/where and never rejects. Never checking out = 0 hours for a Philo event.
  (The earlier "auto check-out when you leave" idea was dropped on purpose.)

- **Sober brothers** (`event_sober_brothers`): for Social event / Party types
  the new-event form asks "Sober?"; Yes reveals a multi-select of non-pledge
  brothers, saved as join rows (readable by everyone, writable only by
  calendar editors) and shown on the Events card and calendar detail.
  "General social event" is no longer offered (value still allowed in the DB).

## No public sign-up (admin-created accounts)

There is no sign-up form. `/login` is sign-in only. Accounts are created
by an admin via the "Add Member" form on the Admin dashboard
(`src/components/add-member-form.tsx` →
`src/app/dashboard/admin/actions.ts`'s `createMember`), which calls
Supabase's **service-role admin API**
(`supabase.auth.admin.createUser`) through `src/lib/supabase/admin.ts`.

**`SUPABASE_SERVICE_ROLE_KEY` bypasses every RLS policy in the database —
treat it like a root password.** It's server-only (no `NEXT_PUBLIC_`
prefix), and `createMember` re-checks the caller is actually an admin
before using it, since the service-role client itself enforces nothing.
**This assistant does not retrieve this key itself** — an attempt to read
it via browser automation was blocked by Claude Code's own safety layer
("Credential Materialization"), correctly. The user retrieves it from
Supabase's dashboard (Settings → API Keys → Secret keys → Reveal) and
pastes it directly into `.env.local` / Vercel's environment variables
themselves.

## Deployment (Vercel)

Three environment variables, all needed: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase's newer "publishable key" format,
`sb_publishable_...` — functionally the same role as the legacy JWT anon
key, just a different token shape; Supabase's client libraries accept
either), `SUPABASE_SERVICE_ROLE_KEY`.

**Known gotcha, hit live**: **Vercel's free Hobby plan cannot deploy from
a *private* GitHub repository owned by an *organization*** (only from
private repos under a personal GitHub account, or from public repos
regardless of owner). The fix that was actually used: made the
`Acacia-Fraternity/acacia-chapter` GitHub repo public (safe — no secrets
are ever committed, real values only ever live in `.env.local`, which is
gitignored). The alternative (Vercel Pro, ~$20/mo) was explicitly not
worth it for a single-chapter free tool. A **Vercel Team** (as opposed to
a personal account) is itself also a paid concept — this project's Vercel
scope is a personal-account-equivalent "Hobby" team, which is free; a real
Team plan is not needed and was never purchased.

**Also hit live**: importing via Vercel's "New Project" flow does **not**
prompt for environment variables in the exact spot expected — the first
deploy went out with zero env vars set, producing a generic "This page is
unavailable" error on the live URL. Environment variables had to be added
*after* the fact under Project Settings → Environment Variables, followed
by a manual Redeploy.

**Claude Code's own safety layer blocks the final "Deploy"/"Redeploy"
click itself** (flagged "Create Public Surface") — spinning up or updating
a live public website is treated as an action requiring the human's own
hand on the button, not something to complete via browser automation even
with prior verbal approval. Expect to hand the literal final click back to
the user every time; everything leading up to it (diagnosing errors,
filling in config, fixing the GitHub visibility issue) can be done via
browser automation.

**After deploying**: Supabase only knows about `localhost:3000` by
default. Password reset (and anything else that redirects back into the
app) will silently redirect to localhost in production unless
Authentication → URL Configuration's Site URL and Redirect URLs are
updated to the real Vercel domain.

**Auth email confirmation**: Supabase's "Confirm email" setting is on by
default, meaning a freshly created account (including admin-created ones)
can't sign in until the confirmation email is clicked. For a single-chapter
internal tool with no public exposure, disabling this (Authentication →
Sign In / Providers → Email → Confirm email) removes real friction with
no real security cost — worth doing once, early.

## Ownership / transferability

The whole point of this app outliving whoever builds it. Three services,
three different free-tier ownership models:
- **GitHub**: repo lives in the `Acacia-Fraternity` GitHub Organization
  (free), not a personal account — add/remove officers as members over
  time.
- **Supabase**: also supports a real free Organization — the project
  should live inside one, not a personal Supabase account.
- **Vercel**: has no free Team/Organization concept — Teams require a
  paid plan. The actual free-tier transfer mechanism is Vercel's
  **Transfer Project** feature (Project Settings → Transfer), moving the
  project to the next officer's *personal* Vercel account when needed,
  rather than trying to keep it under a shared paid Team.

## Conventions

- Comments explain non-obvious *why* (a constraint, a bug that already
  happened, a platform limitation), never *what* — well-named code covers
  that.
- No new dependency without a real reason. `lucide-react` (sidebar icons)
  and `sharp` (one-off crest transparency script, not a runtime
  dependency) were both deliberate, scoped additions, not defaults.
- Match surrounding style; this is a small single-chapter app, not a
  library — prefer the direct, obvious implementation over an abstraction
  built for hypothetical future chapters.

## Exec status, chat channels, Gallery, Dues, Grades, Pledgeship

- **Member status**: pledge (`is_pledge`) / active / exec (`is_exec`; `role='admin'`
  counts as exec via `is_exec()`). `on_pledge_committee` is separate. All four
  flags are admin-only in the privilege trigger.
- **Chat channels** (`messages.channel`): `all` (everyone), `active` (non-pledges),
  `exec` (exec + admins, a normal chat now — it used to be admin-only
  announcements), `pledge` (pledges + committee + admins). Read rules live in
  `can_read_channel()`; `send_message()` only checks `can_chat` + readability.
- **Screenshots can't truly be blocked on the web.** `screen-protection.tsx`
  (mounted in the dashboard layout) blanks the app on window blur / screenshot
  shortcuts; globals.css blocks
  select/print. Phones expose no screenshot signal to web apps — real blocking
  needs a native app (Android FLAG_SECURE).
- **Gallery**: private `gallery` bucket, browser resizes to a 2000px full + 480px
  thumb before upload; grid groups by album (event name or free text).
- **Dues**: `dues_charges` (admin-managed, members read their own). Payment is
  recorded by hand. `/api/cron/reminders` pushes at 7 days / 1 day / due date /
  weekly while overdue (9am-8pm chapter time only), deduped by `dues_reminder_log`.
- **Grades** (`course_grades`): pledges type in their own course percentages (a Canvas
  token integration was built then removed — IU stopped user-level Canvas API
  tokens in Aug 2026; UITS has a Qualtrics survey for Canvas API use cases if an
  official route ever appears). Pledge manages own rows; committee/admins read
  pledges' rows (RLS). Rows untouched for 8+ days are flagged stale.
- **Pledgeship** (`/dashboard/pledgeship`, was Curriculum): Schedule subtab renders
  `src/lib/pledgeship.ts` (transcribed from the Fall 2026 schedule .docx); Quizzes
  subtab is the old curriculum quiz. `/dashboard/curriculum` redirects.
- **Places** (`src/lib/places.ts`): SRSC + IU residence halls — quick-pick in the
  event location picker and markers on the House Presence map.
- **Polls** (`/dashboard/polls`): exec/admins create; `polls.required` makes the
  dashboard layout render `PollGate` instead of the app until the member answers
  (checked on each full page load / login — a client-side navigation doesn't re-run
  the layout). Votes only via `submit_poll_vote()`; counts via `poll_counts()` so
  anonymous polls never expose who voted for what. Wine night events carry
  `events.sorority` (`src/lib/sororities.ts`); Sobers picker is wine night + party.
