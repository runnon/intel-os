-- Theater Picture — subscription entitlements (Analyst tier)
--
-- The paywall gates the analyst assessment/drafting surface. Situation updates
-- stay free and public. An entitlement row is granted/revoked ONLY by the Stripe
-- webhook, through the SECURITY DEFINER grant_entitlement() function below.
--
-- Why the RPC-and-secret dance instead of a service-role write: AGENTS.md requires
-- the Supabase service-role key to live only in the worker env, never in the web
-- (Vercel) app. So the webhook (which runs on Vercel) writes with the ANON key via
-- a SECURITY DEFINER function that self-authorizes against a shared secret stored in
-- a private, RLS-locked config table. No service-role key ever reaches Vercel.

create table entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text,                                   -- 'monthly' | 'annual'
  status text not null default 'inactive',     -- active | trialing | past_due | canceled | inactive
  price_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entitlements_customer_idx on entitlements (stripe_customer_id);

-- Private config table: holds the shared secret the webhook presents to
-- grant_entitlement(). RLS is enabled with NO policies, so neither the anon nor the
-- authenticated role can read or write it over PostREST — only SECURITY DEFINER
-- functions can. The secret value is inserted manually (see docs/STRIPE_SETUP.md);
-- it is deliberately NOT committed to this public repo.
create table entitlement_admin (
  id int primary key default 1,
  grant_secret text not null,
  constraint entitlement_admin_singleton check (id = 1)
);
alter table entitlement_admin enable row level security;

alter table entitlements enable row level security;
-- A signed-in user may read ONLY their own entitlement. No client role may write.
create policy entitlements_self_read on entitlements
  for select using (auth.uid() = user_id);

-- Grant/revoke an entitlement. Called by the Stripe webhook with the anon key.
-- Self-authorizes against entitlement_admin.grant_secret; raises if it does not match,
-- so an anon caller cannot forge entitlements even though the function is definer-owned.
create or replace function grant_entitlement(
  p_secret text,
  p_user_id uuid,
  p_email text,
  p_plan text,
  p_status text,
  p_price_id text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
begin
  select grant_secret into expected from entitlement_admin where id = 1;
  if expected is null or p_secret is null or p_secret <> expected then
    raise exception 'unauthorized';
  end if;

  insert into entitlements as e (
    user_id, email, plan, status, price_id,
    stripe_customer_id, stripe_subscription_id, current_period_end,
    cancel_at_period_end, updated_at
  ) values (
    p_user_id, p_email, p_plan, p_status, p_price_id,
    p_stripe_customer_id, p_stripe_subscription_id, p_current_period_end,
    coalesce(p_cancel_at_period_end, false), now()
  )
  on conflict (user_id) do update set
    email = excluded.email,
    plan = excluded.plan,
    status = excluded.status,
    price_id = excluded.price_id,
    stripe_customer_id = coalesce(excluded.stripe_customer_id, e.stripe_customer_id),
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();
end;
$$;

-- Only allow the anon/authenticated roles to EXECUTE the guarded function; nothing else.
revoke all on function grant_entitlement(text, uuid, text, text, text, text, text, text, timestamptz, boolean) from public;
grant execute on function grant_entitlement(text, uuid, text, text, text, text, text, text, timestamptz, boolean) to anon, authenticated;

-- Price experiment exposure log: the denominator for A/B conversion. One row per user,
-- written the first time they see the paywall pricing. The converting side is the
-- price_id recorded on entitlements. A signed-in user may read/insert only their own row.
create table pricing_exposures (
  user_id uuid primary key references auth.users(id) on delete cascade,
  variant text not null,
  first_seen timestamptz not null default now()
);
alter table pricing_exposures enable row level security;
create policy pricing_exposures_self_read on pricing_exposures
  for select using (auth.uid() = user_id);
create policy pricing_exposures_self_insert on pricing_exposures
  for insert with check (auth.uid() = user_id);
