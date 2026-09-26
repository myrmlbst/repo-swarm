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
      className={`inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 ${FOCUS_RING}`}
    >
      Sign out
    </button>
  );
}
