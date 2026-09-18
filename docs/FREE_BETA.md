# Free-beta mode

The Analyst tier is currently **free**. The paywall still shows a price and a subscribe
button (so we can measure willingness to pay), but clicking grants access at no charge —
no Stripe, no card. The UI says so plainly: *"Free while we're in beta — no card, no charge."*

## How it works

- **Paywall** (`web/app/analyst/page.tsx`): the buttons call `claimFree(plan)`, which POSTs
  `/api/access/claim` and unlocks in place. Price labels come from the A/B experiment.
- **Grant** (`/api/access/claim` → `claim_free_access()` RPC, migration
  `20260918000001_free_beta_access.sql`): grants the signed-in user an active entitlement
  (far-future period, `price_id = 'free_beta'`).
- **Experiment**: `PRICING_EXPERIMENT=on` enables the $10-vs-$20 split with no Stripe prices.
  Each claim fires a PostHog `subscribed` event `{ free: true, variant, plan }`; the
  `pricing_viewed → subscribed` funnel shows which price converts better.

## Measuring willingness to pay

- **PostHog** (project `intel-os`, id 615149): the funnel insight already exists — split by
  `variant` to compare $10 vs $20 click-through.
- **Supabase**: `pricing_exposures` (denominator) vs entitlements with `price_id='free_beta'`
  (who claimed). Variant is recomputable from the user id.

## Switching back to real charging

Everything for paid billing still exists, just dormant:

1. Point the paywall buttons from `claimFree` back to `subscribe` (Stripe checkout).
2. Restore the trial/card copy if wanted.
3. Complete the Stripe env setup in `docs/STRIPE_SETUP.md` (restricted key, products,
   webhook, `STRIPE_*` + `ENTITLEMENT_GRANT_SECRET` env vars).
4. Optionally unset `PRICING_EXPERIMENT` and drive the split off the `_B` price ids instead.

No data model changes are needed to switch — `claim_free_access` and the Stripe webhook
write to the same `entitlements` table.
