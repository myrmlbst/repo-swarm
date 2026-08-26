"use client";

import { createClient } from "@/lib/supabase/client";
import { FOCUS_RING } from "@/lib/styles";

export function SignOutButton() {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={`rounded-md text-sm text-gray-500 hover:text-gray-700 ${FOCUS_RING}`}
    >
      Sign out
    </button>
  );
}
