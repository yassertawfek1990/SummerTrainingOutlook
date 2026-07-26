import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Regular server client — respects the logged-in user's session and RLS policies.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore if middleware
            // is refreshing the session.
          }
        },
      },
    }
  );
}

// Admin client — uses the service role key, bypasses Row Level Security entirely.
// ONLY use this in server-only code (route handlers, cron jobs) that need to
// read/write across all students, e.g. the unlock-content cron and the leaderboard.
// NEVER import this into a Client Component or expose the key to the browser.
export function createAdminClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
