import { after, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics";
import { safeInternalPath } from "@/lib/safe-redirect";

export const runtime = "nodejs";

// Landing for sign-in links, email confirmation, password recovery and Google:
// exchange the PKCE code (or verify a token-hash link) for a cookie-backed session,
// then continue only to a validated internal path.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeInternalPath(url.searchParams.get("next"));

  const supabase = code || tokenHash ? await createSupabaseServerClient() : null;
  const result = supabase && code
    ? await supabase.auth.exchangeCodeForSession(code)
    : supabase && tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "signup" | "recovery" | "email" })
      : null;
  if (result && !result.error) {
    const user = result.data.user;
    if (user) after(() => track(user.id, "signed_in"));
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // Keep where they were headed, so a fresh link still returns them there.
  return NextResponse.redirect(new URL(`/signin?error=link&next=${encodeURIComponent(next)}`, url.origin));
}
