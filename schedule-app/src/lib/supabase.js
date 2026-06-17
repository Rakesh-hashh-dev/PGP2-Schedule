import { createClient } from "@supabase/supabase-js";

// Clerk's session token rides on every request (native third-party auth),
// so Supabase RLS sees the Clerk user id as auth.jwt()->>'sub'.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { accessToken: async () => (window.Clerk?.session ? window.Clerk.session.getToken() : null) }
);
