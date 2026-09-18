# Stripe Analyst subscription — setup

The Analyst tier ($20/mo, $190/yr) includes a one-time seven-day trial and gates the
7D/30D/full issue archive plus the analyst drafting workspace (`/analyst`). The complete
trailing 72-hour map stays free and public. Payments run through the **existing
shared Stripe account** `acct_1SSUvpPzSHwImUes`; intel-os objects are isolated from the
other product in that account by `metadata app=intel-os` and a dedicated webhook.

Architecture: hosted Stripe Checkout (redirect — no Stripe JS in the app, per NFR-4/5).
A webhook grants an `entitlements` row via a `SECURITY DEFINER` RPC guarded by a shared
secret, so **no Supabase service-role key ever lives in the web/Vercel env** (AGENTS.md).

## One-time setup

### 1. Supabase — apply the migration
For a zero-downtime rollout against the intel-os project (`huhrdcxvdgmuvdgwymdj`):

1. Apply `20260917000001_entitlements.sql` if it is not already present.
2. Apply the additive `20260917000002_subscription_hardening.sql`.
3. Deploy the updated web application.
4. Apply `20260917000003_subscription_enforcement.sql` to remove legacy public reads and
   retire the old non-idempotent webhook function.

### 2. Supabase — set the grant secret (kept out of this repo)
Pick a strong random string (this is your `ENTITLEMENT_GRANT_SECRET`) and store it:
```sql
insert into entitlement_admin (id, grant_secret) values (1, '<random-secret>')
  on conflict (id) do update set grant_secret = excluded.grant_secret;
```

### 3. Supabase — enable email auth
Auth → Providers → Email: enable, with "magic link" / OTP. Under Auth → URL
Configuration set Site URL to the production origin and add redirect URLs:
`https://intel-os-self.vercel.app/auth/callback` (and `http://localhost:3000/auth/callback`
for dev).

### 4. Stripe — restricted key
Use a temporary restricted setup key with write access to **Products** and **Prices** for
step 5. Do not store that key in Vercel. Create a separate runtime restricted key with only
the permissions required by Checkout Sessions, Billing Portal sessions, Customers, and
Subscriptions. Metadata separates reporting and webhook handling; it is not a security
boundary inside a shared Stripe account, so keep the runtime key's permissions minimal.

### 5. Stripe — create the product + prices
```sh
cd web && STRIPE_SECRET_KEY=rk_live_... node scripts/create-stripe-products.mjs
```
Copy the printed `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` IDs.

### 6. Stripe — webhook endpoint
Developers → Webhooks → add endpoint `https://intel-os-self.vercel.app/api/stripe/webhook`,
events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

### 7. Vercel — env vars (project intel-os)
Set: `NEXT_PUBLIC_SITE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `ENTITLEMENT_GRANT_SECRET`
(the same value as step 2). To run the price A/B test, also set
`STRIPE_PRICE_MONTHLY_B` + `STRIPE_PRICE_ANNUAL_B`. Redeploy.

### 8. Stripe — production subscription settings

Before accepting live subscriptions:

- Enable Stripe's trial-ending, failed-payment, and expiring-card customer emails.
- Configure Smart Retries and the final failed-payment state (`canceled` or `unpaid`);
  either state removes product access through the subscription webhook.
- Configure the Billing Portal for payment-method updates, invoice downloads,
  cancellation, and cancellation-reason collection.
- Set the public business name, support contact, statement descriptor, refund policy,
  privacy policy, and terms links shown by Checkout and the portal.
- Decide tax obligations before enabling Stripe Tax; do not enable automatic tax until
  registrations and product tax codes have been reviewed.
- Alert on failed webhook deliveries and retain the old price environment variables
  while any legacy subscription still depends on them. New subscriptions also persist
  their cadence in metadata so later price rotation remains safe.
- Rotate the setup key out after product creation. Keep the runtime key and webhook/grant
  secrets separate, least-privileged, and covered by the deployment secret-rotation plan.

## Price A/B test ($10 vs $20)
Each signed-in user is assigned a variant by a deterministic hash of their user id
(50/50, server-side — see `web/lib/pricing.ts`), so their price is stable and can't be
gamed from the client. The experiment is **live only when the `_B` price env vars are
set**; otherwise everyone sees variant A ($20/$190).

- Exposure (denominator) is logged once per user in `pricing_exposures`.
- Conversion (numerator) is the `price_id` on their `entitlements` row.
- Compare in Supabase, e.g.:
  ```sql
  select e.variant,
         count(*) as exposed,
         count(ent.user_id) filter (where ent.status in ('active','trialing')) as converted
  from pricing_exposures e
  left join entitlements ent on ent.user_id = e.user_id
  group by e.variant;
  ```
- To restart with fresh buckets, bump `EXPERIMENT_SALT` in `web/lib/pricing.ts`.
- The Billing Portal (cancel / update card / invoices) is auto-enabled on first use in
  test mode; in live mode, activate it once under Settings → Billing → Customer portal.

## Trial and drafting limits

- Checkout collects a payment method and starts one seven-day trial per Supabase account.
- Stripe cancels at trial end if no payment method is available; otherwise the selected
  monthly or annual price begins automatically.
- The default drafting allowance is 20 total requests during the trial, then 200 requests
  per UTC month, with a five-request-per-minute burst limit. Override with
  `ANALYST_TRIAL_REQUEST_LIMIT`, `ANALYST_MONTHLY_REQUEST_LIMIT`, and
  `ANALYST_MINUTE_REQUEST_LIMIT` in the server environment.
- Webhook event IDs and creation times are recorded so retries are idempotent and stale
  events cannot overwrite newer subscription state.

## Local development
`stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the printed
`whsec_...` as `STRIPE_WEBHOOK_SECRET` in `web/.env.local`. Use test-mode keys/prices.

## Shared-account routing
- Every session, subscription, product, and price carries `metadata.app = "intel-os"`.
- The webhook **ignores** any event not tagged `app=intel-os`, so the other product's
  payments never touch intel-os entitlements.
- Reporting: filter by that metadata to separate intel-os revenue in the dashboard.
- Metadata does not prevent a sufficiently privileged account key from touching other
  objects. A dedicated Stripe account is the stronger isolation option.
