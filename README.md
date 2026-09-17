# Acacia

Chapter attendance, involvement, and chat tracker, themed on Acacia
Fraternity's real brand (see [BRAND.md](BRAND.md) for the full research —
colors, fonts, logo usage, sourced from their official brand guide).

- Brothers sign in, see open events on a list or a real calendar, and
  check in — check-in only succeeds if their phone's GPS says they're
  actually near the event location.
- A shared chapter chat, with sending and reacting each independently
  gated by a per-member permission an admin controls.
- A Chapter tab for meeting notes and uploaded slides/files.
- A Parking tab — every brother's spot number, license plate, and
  make/model, self-service (admins can edit anyone's).
- A Personalization tab: light/dark/system appearance, and a choice of
  home-screen icon (the Acacia "A" or the crest) for "Add to Home Screen."
- Officers create events, see who showed up, and manage every member's
  role/chat/react permissions from an admin dashboard.

Built with Next.js (hosted on Vercel) and Supabase (database + login +
realtime + file storage). Both have free tiers that comfortably cover a
single chapter's usage.

## Why it's built this way (read this before touching ownership/access)

This app is meant to outlive whoever builds it. Two things make that possible:

1. **The GitHub repo, Vercel project, and Supabase project should live under
   a chapter-owned account/organization, not a personal one.** If they're
   tied to one brother's personal login, the app becomes inaccessible the
   day that person graduates and stops checking that email. See "Handing
   this off" below.
2. **Admin access is a database flag (`profiles.role = 'admin'`), not
   something hardcoded in the code.** Promoting the next officer to admin —
   or demoting an outgoing one — is one click in the Supabase dashboard.
   Nobody ever needs to touch code or redeploy anything to change who's in
   charge of the app.

## First-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free
   tier). Note the project's URL and anon/public API key from
   **Project Settings > API**.
2. **Run the schema**: open the Supabase dashboard's **SQL Editor**, paste
   the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
   This creates all the tables, security rules, and the `check_in()` function
   that verifies GPS distance server-side.
3. **Copy env vars**: `cp .env.local.example .env.local` and fill in the
   Supabase URL/key from step 1.
4. **Install and run locally**:
   ```bash
   npm install
   npm run dev
   ```
   Open <http://localhost:3000>, sign up with your own account — this
   creates your `profiles` row with the default `member` role.
5. **Make yourself admin**: in the Supabase dashboard, go to
   **Table Editor > profiles**, find your row, and change `role` from
   `member` to `admin`. Refresh the app — you'll now see an **Admin** link
   in the nav for creating events.
6. **Deploy to Vercel**: push this repo to GitHub, then import it at
   [vercel.com/new](https://vercel.com/new). Add the same two environment
   variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in
   the Vercel project's **Settings > Environment Variables**. Deploy.

That's it — brothers visit the Vercel URL, sign up, and check in at events.

## Adding/removing an admin (officer transition)

No code changes needed. In the Supabase dashboard: **Table Editor >
profiles**, find the person's row, change `role` between `member` and
`admin`. Takes effect on their next page load.

## Handing this off (graduation / officer transition)

Do this well before you lose access to your personal accounts:

- **GitHub**: repo should live in a chapter GitHub Organization (not your
  personal account). Add the incoming officer as a member, make them an
  Owner, remove yourself when you're ready to step away.
- **Vercel**: create/use a Vercel Team tied to the same GitHub org and
  import the project under the team instead of your personal account.
  Vercel's free tier supports this.
- **Supabase**: Supabase also supports Organizations — move the project
  into a chapter org and add the incoming officer as a member with Owner
  access.
- **Write down where the Supabase URL/anon key live** (they're also in
  Vercel's env vars, so anyone with Vercel access can always find them
  again) somewhere the next officer will actually find it — a chapter
  shared drive, not just this repo's `.env.local` on your personal laptop.

## How check-in actually works (for whoever debugs this next)

Check-ins are NOT validated in the app's JavaScript — that would be trivial
to fake by editing values in the browser dev console. Instead:

- The `checkins` table has no INSERT permission for regular users at all
  (enforced by Postgres Row Level Security).
- The only way to create a check-in row is calling the `check_in()` Postgres
  function (see `supabase/schema.sql`), which independently:
  1. Confirms the event is currently open (`starts_at <= now <= ends_at`).
  2. Computes the real distance (Haversine formula) between the submitted
     GPS coordinates and the event's location.
  3. Rejects the check-in if that distance exceeds the event's
     `radius_meters`.
- This means even a technically savvy brother can't spoof a check-in
  without actually spoofing their phone's GPS at the OS level — a
  meaningfully higher bar than anything client-side code could enforce.

## How chat permissions actually work

Same philosophy as check-in: permission checks live in the database, not
just the UI hiding buttons.

- `profiles.can_chat` / `profiles.can_react` are the actual gates. The
  `messages` and `message_reactions` tables have **no direct INSERT policy**
  for regular users — the only way to write to them is the `send_message()`
  and `toggle_reaction()` Postgres functions, which check the caller's
  permission before writing anything.
- Only an admin can change someone's `role`, `can_chat`, or `can_react`.
  This is enforced by the `prevent_self_privilege_escalation` trigger in
  `supabase/schema.sql` — without it, Postgres Row Level Security alone
  would let a member run an UPDATE on their *own* profile row and grant
  themselves admin, since RLS restricts which *rows* a policy allows, not
  which *columns*. The admin dashboard's toggles are just a convenience
  layer on top of this — the real enforcement doesn't care whether the
  request came from that UI or someone poking the API directly.
- Chat is realtime (Supabase's Postgres change feed over a websocket, see
  `src/components/chat-room.tsx`) rather than polling.

## Chapter files, Parking, and Storage

`supabase/schema.sql` also creates a **private** Supabase Storage bucket
(`chapter-files`) for slide/PDF uploads — not publicly readable by URL;
every download in the Chapter tab goes through a signed URL generated
server-side with a 5-minute expiry. Only admins can upload/delete;
everyone signed in can read. Notes and files are both admin-authored,
same pattern as events.

Parking is the one self-service table: any brother can create/edit/delete
their *own* row (RLS `auth.uid() = user_id or is_admin()`), admins can
edit anyone's. There's no privilege-escalation risk here the way there
was with `profiles` — editing your own parking info can't grant you
anything — so it's a plain RLS policy, no extra trigger needed.

## Personalization

See [BRAND.md](BRAND.md#personalization-theme-and-home-screen-icon) for
the full mechanism (cookies, not account data; dynamic PNG generation via
`next/og` for the home-screen icon; the "you have to re-add the shortcut"
caveat).

## Local development

```bash
npm run dev      # start local dev server at localhost:3000
npm run build    # production build (also run by Vercel on deploy)
npm run lint     # ESLint
```

There's no test suite yet. Verify changes by actually running the app
locally against your Supabase project and clicking through the flow.
