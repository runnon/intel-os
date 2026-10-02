import { createSupabaseServerClient, getSessionUser, hasSupabaseAuthCookie } from "@/lib/supabase/server";

// 2026-10-01 — fully free: the paywall is removed. Archive reads need no identity at all,
// and the drafting workspace needs only a signed-in user (the per-user drafting quota is
// keyed on that identity). The entitlement helpers below remain for the dormant Stripe
// routes (checkout/portal/webhook) so a paid tier can be re-enabled; nothing in the UI
// gates on them any more. See docs/DECISIONS.md.

export type Entitlement = {
  status: string;
  plan: string | null;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_used: boolean;
  trial_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type ViewerEntitlement = {
  user: { id: string; email?: string } | null;
  entitlement: Entitlement | null;
  active: boolean;
};

// The signed-in user's entitlement row, or null. Read via the user's session so RLS
// scopes it to their own row.
export async function getEntitlement(): Promise<Entitlement | null> {
  if (!(await hasSupabaseAuthCookie())) return null;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("entitlements")
    .select("status, plan, price_id, current_period_end, cancel_at_period_end, trial_used, trial_end, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as Entitlement) ?? null;
}

/** Resolve identity and entitlement in one authenticated database round trip. */
export async function getViewerEntitlement(): Promise<ViewerEntitlement> {
  if (!(await hasSupabaseAuthCookie())) return { user: null, entitlement: null, active: false };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, entitlement: null, active: false };

  const { data } = await supabase
    .from("entitlements")
    .select("status, plan, price_id, current_period_end, cancel_at_period_end, trial_used, trial_end, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const entitlement = (data as Entitlement) ?? null;
  return {
    user: { id: user.id, email: user.email },
    entitlement,
    active: isActive(entitlement),
  };
}

/** Whether an entitlement grants live access right now. */
export function isActive(ent: Entitlement | null): boolean {
  if (!ent) return false;
  if (ent.status !== "active" && ent.status !== "trialing") return false;
  // Fail closed if Stripe did not provide a valid paid/trial period, and deny once
  // that period lapses even if a cancellation webhook was missed.
  if (!ent.current_period_end) return false;
  const periodEnd = new Date(ent.current_period_end).getTime();
  return Number.isFinite(periodEnd) && periodEnd > Date.now();
}

/** Drafting access rule: any signed-in user. No entitlement or plan is required. */
export function analystAccessFor(user: { id: string } | null | undefined): boolean {
  return Boolean(user?.id);
}

/** The signed-in user allowed to draft, or null when signed out. */
export async function getAnalystUser(): Promise<{ id: string; email?: string } | null> {
  const user = await getSessionUser();
  return user && analystAccessFor(user) ? { id: user.id, email: user.email } : null;
}

export type AnalystQuotaResult = "ok" | "unauthenticated" | "subscription_required" | "minute_limit" | "trial_limit" | "monthly_limit";

function configuredLimit(name: string, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(process.env[name] ?? String(fallback), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, maximum)) : fallback;
}

export function analystQuotaLimits() {
  return {
    monthly: configuredLimit("ANALYST_MONTHLY_REQUEST_LIMIT", 200, 10_000),
    minute: configuredLimit("ANALYST_MINUTE_REQUEST_LIMIT", 5, 60),
    trial: configuredLimit("ANALYST_TRIAL_REQUEST_LIMIT", 20, 1_000),
  };
}

/** Atomically consume one drafting request from the signed-in user's allowance. */
export async function consumeAnalystQuota(): Promise<AnalystQuotaResult> {
  const limits = analystQuotaLimits();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("consume_analyst_quota", {
    p_monthly_limit: limits.monthly,
    p_minute_limit: limits.minute,
    p_trial_limit: limits.trial,
  });
  if (error) throw new Error(`consume_analyst_quota failed: ${error.message}`);
  return data as AnalystQuotaResult;
}
