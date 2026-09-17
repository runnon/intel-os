import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

// Magic-link landing: exchanges the PKCE code for a session, then redirects on.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/analyst";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await track(data.user.id, "signed_in", undefined, { email: data.user.email });
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/signin?error=link", url.origin));
}
