import { after, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics";
import { safeInternalPath } from "@/lib/safe-redirect";

export const runtime = "nodejs";

// Magic-link landing: exchanges the PKCE code for a session, then redirects on.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) after(() => track(data.user.id, "signed_in"));
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/signin?error=link", url.origin));
}
