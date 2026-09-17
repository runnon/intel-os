# Product analytics (PostHog)

intel-os captures product events **server-side only** (`posthog-node` from API routes) —
never a browser script — so the deployed app stays CDN-free and the gov/NIPRNet build can
run with analytics simply switched off. It's a no-op unless `POSTHOG_KEY` is set.

## One-time setup

1. **Create the project.** In PostHog (org Alleykat), use the project switcher (top-left)
   → **New project**, name it `intel-os`. (Project creation isn't available over the API
   connector — it's an org-admin action in the UI.)
2. **Copy its Project API key** (`phc_...`, Settings → Project) into `POSTHOG_KEY` in
   Vercel (and `web/.env.local` for dev). Leave `POSTHOG_HOST` at `https://us.i.posthog.com`
   unless self-hosting.
3. Redeploy. Events start flowing on the next signup/checkout.

## Events

All keyed to the Supabase user id as the PostHog `distinctId`, so persons line up with app
users; `email` is set as a person property.

| Event | Fired from | Properties |
|---|---|---|
| `signed_in` | `/auth/callback` | — |
| `pricing_viewed` | `/api/pricing` (first exposure only) | `variant`, `monthly_amount`, `annual_amount` |
| `checkout_started` | `/api/stripe/checkout` | `plan`, `variant` |
| `subscribed` | Stripe webhook (checkout completed) | `plan`, `variant`, `price_id` |
| `subscription_canceled` | Stripe webhook (sub deleted) | `plan` |

## Price A/B readout

The `variant` property on `pricing_viewed` and `subscribed` gives the $10-vs-$20 funnel:
build a funnel `pricing_viewed → subscribed` broken down by `variant`. (This complements
the Supabase-only readout in docs/STRIPE_SETUP.md; either works.)
