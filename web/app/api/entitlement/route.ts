import { NextResponse } from "next/server";
import { getAnalystUser } from "@/lib/entitlement";

export const runtime = "nodejs";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

// Drafting-workspace status for the client. Fully free (2026-10-01): any signed-in user
// has access; there is no plan, price, or subscription state to report.
export async function GET() {
  const user = await getAnalystUser();
  if (!user) {
    return NextResponse.json({ signedIn: false, active: false }, { headers: PRIVATE_NO_STORE });
  }
  return NextResponse.json(
    { signedIn: true, email: user.email ?? null, active: true },
    { headers: PRIVATE_NO_STORE },
  );
}
