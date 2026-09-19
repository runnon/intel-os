# Product analytics (PostHog)

intel-os captures product events **server-side only** (`posthog-node` from API routes) —
never a browser script — so the deployed app stays CDN-free and the gov/NIPRNet build can
run with analytics switched off. It is a no-op unless both `POSTHOG_KEY` and an explicit
`POSTHOG_HOST` are set. Captures run after the response and never sit on the sign-in,
checkout, or webhook critical path.

## One-time setup

1. **Create the project.** In PostHog (org Alleykat), use the project switcher (top-left)
   → **New project**, name it `intel-os`. (Project creation isn't available over the API
   connector — it's an org-admin action in the UI.)
2. **Copy its Project API key** (`phc_...`, Settings → Project) into `POSTHOG_KEY` in
   Vercel (and `web/.env.local` for dev). Set `POSTHOG_HOST` explicitly to the approved
   ingestion endpoint; a restricted-network deployment should leave both unset or point
   the host at its self-hosted collector.
3. Redeploy. Events start flowing on the next signup/checkout.

## Events

All events use the opaque Supabase user id as the PostHog `distinctId`. Email addresses,
prompts, issue bodies, and source content are not sent.

| Event | Fired from | Properties |
|---|---|---|
| `signed_in` | `/auth/callback` | — |
| `pricing_viewed` | `/api/pricing` (first exposure only) | `variant`, `monthly_amount`, `annual_amount` |
| `pricing_intent` | `/api/access/claim` (verified free-beta claim) | `plan`, `variant`, `access_granted` |
| `checkout_started` | `/api/stripe/checkout` | `plan`, `variant`, `trial` |
| `subscribed` | Stripe webhook (checkout completed) | `plan`, `variant`, `price_id`, `trial` |
| `subscription_canceled` | Stripe webhook (sub deleted) | `plan` |

## Price A/B readout

During free beta, use `pricing_viewed → pricing_intent` broken down by `variant`. This is
a fake-door price-intent measure, not a completed purchase or proven willingness to pay.
Once charging is live, use `pricing_viewed → checkout_started → subscribed`; that funnel
measures actual checkout and paid/trial conversion.
