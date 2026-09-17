# Stripe Analyst subscription — setup

The Analyst tier ($20/mo, $190/yr) gates the analyst drafting workspace (`/analyst`).
The situation map and updates stay free and public. Payments run through the **existing
shared Stripe account** `acct_1SSUvpPzSHwImUes`; intel-os objects are isolated from the
other product in that account by `metadata app=intel-os` and a dedicated webhook.

Architecture: hosted Stripe Checkout (redirect — no Stripe JS in the app, per NFR-4/5).
A webhook grants an `entitlements` row via a `SECURITY DEFINER` RPC guarded by a shared
secret, so **no Supabase service-role key ever lives in the web/Vercel env** (AGENTS.md).

## One-time setup

### 1. Supabase — apply the migration
Run `supabase/migrations/20260917000001_entitlements.sql` against the intel-os project
(`huhrdcxvdgmuvdgwymdj`).

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
Create a **restricted** key (Developers → API keys → Restricted). Grant write on
**Products**, **Prices**, **Checkout Sessions**, **Customers**, and read on
**Subscriptions**. This is the intel-os deployment's key — it can't touch the other
product's data beyond these scopes.

### 5. Stripe — create the product + prices
```sh
cd web && STRIPE_SECRET_KEY=rk_live_... node scripts/create-stripe-products.mjs
```
Copy the printed `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` IDs.

### 6. Stripe — webhook endpoint
Developers → Webhooks → add endpoint `https://intel-os-self.vercel.app/api/stripe/webhook`,
events: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

### 7. Vercel — env vars (project intel-os)
Set: `NEXT_PUBLIC_SITE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `ENTITLEMENT_GRANT_SECRET`
(the same value as step 2). Redeploy.

## Local development
`stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the printed
`whsec_...` as `STRIPE_WEBHOOK_SECRET` in `web/.env.local`. Use test-mode keys/prices.

## How isolation works (shared account)
- Every session, subscription, product, and price carries `metadata.app = "intel-os"`.
- The webhook **ignores** any event not tagged `app=intel-os`, so the other product's
  payments never touch intel-os entitlements.
- Reporting: filter by that metadata to separate intel-os revenue in the dashboard.
