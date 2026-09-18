import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses Row Level Security entirely.
 * NEVER import this from a Client Component or anything that ships to the
 * browser; it only belongs in Server Actions / Route Handlers. Used
 * exclusively for admin-side account creation (see
 * src/app/dashboard/admin/actions.ts's createMember), since a brand-new
 * member's account has to be created by an officer, not by the member
 * signing themselves up.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — add it to .env.local (and Vercel's env vars) from Supabase's Settings > API Keys > Secret keys. Never expose this value to the browser.",
    );
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
