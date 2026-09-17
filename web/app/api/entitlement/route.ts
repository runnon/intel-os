import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";
import { hasActiveEntitlement } from "@/lib/entitlement";

export const runtime = "nodejs";

// Lightweight status for the client: is the viewer signed in, and do they hold an
// active Analyst subscription. Drives the sign-in / subscribe paywall on the page.
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({
    signedIn: Boolean(user),
    email: user?.email ?? null,
    active: await hasActiveEntitlement(),
  });
}
