import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

// Service-role client: bypasses RLS. Only used server-side, after we've
// verified the caller's identity ourselves (see lib/auth.ts).
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
