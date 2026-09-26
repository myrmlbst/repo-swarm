import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // GitHub/Supabase send the reason here when the user denies access or the
  // provider is misconfigured — show it on /login instead of a generic error.
  const providerError = searchParams.get("error_description");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  const reason = providerError ?? "GitHub sign-in failed. Please try again.";
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(reason)}`,
  );
}
