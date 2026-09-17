import { NextResponse } from "next/server";
import { getSessionUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { billingPortalUrl } from "@/lib/stripe";

export const runtime = "nodejs";

// Opens the Stripe Billing Portal for the signed-in subscriber: cancel, resume, update
// the card, or download invoices. Returns the hosted portal URL to redirect to.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: ent } = await supabase
    .from("entitlements")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ent?.stripe_customer_id) {
    return NextResponse.json({ error: "no billing account found" }, { status: 404 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const url = await billingPortalUrl(ent.stripe_customer_id, `${origin}/analyst`);
  return NextResponse.json({ url });
}
