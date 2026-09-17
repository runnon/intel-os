import { createSupabaseServerClient, getSessionUser } from "@/lib/supabase/server";

// True when the signed-in user holds a live Analyst subscription. The paywall boundary
// for the analyst drafting workspace; the situation map/updates stay free and public.
export async function hasActiveEntitlement(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("entitlements")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return false;
  if (data.status !== "active" && data.status !== "trialing") return false;
  // Defense in depth: if a cancel webhook was missed, deny once the paid period lapses.
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) return false;
  return true;
}
