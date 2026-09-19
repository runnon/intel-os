# Free-beta price-intent test

The Analyst tier is currently free, but access is granted only after a person completes
email/password onboarding, confirms their email, and chooses a displayed monthly or annual
plan. After that choice, the product reveals that beta access is free: no card is collected
and no charge occurs.

The reveal explicitly says that paid access will require a separate opt-in when beta ends.
The product must never claim that a payment succeeded or imply that it can charge later
without new consent.

## Flow

1. The visitor creates an account with email and password.
2. Supabase confirms the email and establishes a session.
3. `/analyst` shows the assigned A/B prices.
4. The visitor selects the plan they would use.
5. `/api/access/claim` verifies the confirmed user, records `pricing_intent`, grants the
   free-beta entitlement, and returns no payment URL.
6. The interface reveals that access is free during beta and confirms that no card was
   collected and no charge was made.

`claim_free_access()` can grant access only to a confirmed `auth.uid()`; a browser cannot
claim access for another user. The first plan selection is immutable and returns the only
countable conversion, preventing repeated clicks or plan switching from inflating the test.
The row is marked with `price_id = 'free_beta'` so the account bar never presents a false
renewal date or billing-portal action.

Deploy both `20260918000001_free_beta_access.sql` and
`20260918000002_free_beta_onboarding.sql` before the updated web application. The second
migration adds the confirmed-email and one-time-choice enforcement expected by the API.

## Interpreting the experiment

Use the PostHog funnel `pricing_viewed → pricing_intent`, split by `variant`. This measures
price-page intent after verified onboarding. It is not equivalent to a completed checkout,
a card-backed trial, or proven willingness to pay, so do not combine it with the Stripe
`subscribed` metric.

## Switching to charging

The Stripe checkout, seven-day trial, portal, and webhook implementation remains available:

1. Point the plan buttons to `/api/stripe/checkout` instead of `/api/access/claim`.
2. Restore the trial and automatic-renewal disclosure before the action.
3. Complete the restricted Stripe environment and webhook setup in `docs/STRIPE_SETUP.md`.
4. Leave historical `pricing_intent` events separate from paid `subscribed` events.

No entitlement schema change is required; both paths write the same entitlement model.
