import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Explicit rather than relying on defaults: the session (and its
        // refresh token) persists in cookies and silently refreshes itself
        // forever, so signing in once keeps you signed in indefinitely —
        // the only way out is SignOutButton's explicit signOut() call.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
}
