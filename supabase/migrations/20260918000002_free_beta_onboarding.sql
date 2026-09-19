-- Require completed email onboarding and make the free-beta price choice one-time.
-- The returned boolean is true only for the first access grant, which keeps the
-- pricing_intent conversion event from being counted more than once per user.

drop function if exists public.claim_free_access(text);

create function public.claim_free_access(p_plan text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_email_confirmed_at timestamptz;
  v_existing public.entitlements%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_plan is null or p_plan not in ('monthly', 'annual') then
    raise exception 'invalid plan';
  end if;

  select email, email_confirmed_at
    into v_email, v_email_confirmed_at
  from auth.users
  where id = auth.uid();

  if v_email_confirmed_at is null then
    raise exception 'confirmed email required';
  end if;

  select * into v_existing
  from public.entitlements
  where user_id = auth.uid()
  for update;

  -- Preserve the first beta-plan selection and never replace a live paid/trial
  -- entitlement with a free grant.
  if found and (
    v_existing.price_id = 'free_beta'
    or (
      v_existing.status in ('active', 'trialing')
      and v_existing.current_period_end is not null
      and v_existing.current_period_end > now()
    )
  ) then
    return false;
  end if;

  insert into public.entitlements as e (
    user_id, email, plan, status, price_id,
    current_period_end, cancel_at_period_end, updated_at
  ) values (
    auth.uid(), coalesce(v_email, 'unknown'), p_plan, 'active', 'free_beta',
    (now() + interval '100 years'), false, now()
  )
  on conflict (user_id) do update set
    email = excluded.email,
    plan = excluded.plan,
    status = 'active',
    price_id = 'free_beta',
    stripe_subscription_id = null,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = false,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.claim_free_access(text) from public;
grant execute on function public.claim_free_access(text) to authenticated;
