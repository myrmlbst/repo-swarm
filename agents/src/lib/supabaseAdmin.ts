import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

// Service-role client: bypasses RLS. Only used by the worker, server-side.
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
