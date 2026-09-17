import { createSupabaseServerClient, getSessionUser } from "@/lib/supabase/server";

export type Entitlement = {
  status: string;
  plan: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

// The signed-in user's entitlement row, or null. Read via the user's session so RLS
// scopes it to their own row.
export async function getEntitlement(): Promise<Entitlement | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("entitlements")
    .select("status, plan, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as Entitlement) ?? null;
}

/** Whether an entitlement grants live access right now. */
export function isActive(ent: Entitlement | null): boolean {
  if (!ent) return false;
  if (ent.status !== "active" && ent.status !== "trialing") return false;
  // Defense in depth: if a cancel webhook was missed, deny once the paid period lapses.
  if (ent.current_period_end && new Date(ent.current_period_end) < new Date()) return false;
  return true;
}

// The paywall boundary for the analyst drafting workspace; the situation map/updates
// stay free and public.
export async function hasActiveEntitlement(): Promise<boolean> {
  return isActive(await getEntitlement());
}
