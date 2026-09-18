-- Free-beta access grant.
--
-- The paywall still shows the (A/B) price so we can measure willingness-to-pay, but
-- clicking "get access" grants the entitlement for free instead of charging. This is a
-- self-service grant: an authenticated user grants free access to THEMSELVES (auth.uid()),
-- so no admin secret is needed — the worst anyone can do is claim the thing we're giving
-- away. Sets a far-future period so isActive() passes; price_id 'free_beta' marks it.

create or replace function claim_free_access(p_plan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_plan is null or p_plan not in ('monthly', 'annual') then
    raise exception 'invalid plan';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.entitlements as e (
    user_id, email, plan, status, price_id,
    current_period_end, cancel_at_period_end, updated_at
  ) values (
    auth.uid(), coalesce(v_email, 'unknown'), p_plan, 'active', 'free_beta',
    (now() + interval '100 years'), false, now()
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = 'active',
    price_id = 'free_beta',
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = false,
    updated_at = now();
end;
$$;

revoke all on function claim_free_access(text) from public;
grant execute on function claim_free_access(text) to authenticated;
