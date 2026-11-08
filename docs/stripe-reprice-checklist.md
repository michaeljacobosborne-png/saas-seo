# Stripe repricing checklist (for Michael to run by hand)

Nothing here has been done. The code never creates, changes or archives anything
in Stripe. The new prices only go live when the environment variables at the end
point at them, so do the Stripe steps first, then the env vars, then deploy.

Plan keys in code and in the database do not change (`starter`, `pro`,
`agency`), so the environment variable NAMES do not change either, only their
values. Customers see Solo, Pro and Agency.

## 1. Products (Stripe Dashboard > Product catalogue)

Rename, do not recreate, so history stays attached:

| Existing product | New name |
|---|---|
| Byline Starter | Byline Solo |
| Byline Growth | Byline Pro |
| Byline Multi-Brand (or Team) | Byline Agency |

Update each description to one line about pages monitored, for example
"Daily crawler access checks and change alerts on 15 pages, 1 domain."

## 2. Prices to create

A price's amount cannot be edited in Stripe, so Pro and Agency need new prices.
Solo's amounts are unchanged, so its existing prices are reused.

| Product | Interval | Amount | Action | Env var to point at it |
|---|---|---|---|---|
| Solo | monthly | $49 | reuse existing | `STRIPE_PRICE_STARTER_MONTHLY` (unchanged) |
| Solo | annual | $470 | reuse existing | `STRIPE_PRICE_STARTER_ANNUAL` (unchanged) |
| Pro | monthly | $129 | CREATE | `STRIPE_PRICE_PRO_MONTHLY` |
| Pro | annual | $1,238 | CREATE | `STRIPE_PRICE_PRO_ANNUAL` |
| Agency | monthly | $599 | CREATE | `STRIPE_PRICE_AGENCY_MONTHLY` |
| Agency | annual | $5,750 | CREATE | `STRIPE_PRICE_AGENCY_ANNUAL` |
| Solo founding rate | monthly | $39 | reuse existing | `STRIPE_PRICE_STARTER_FOUNDER` (unchanged) |
| Pro founding rate | monthly | $99 | CREATE | `STRIPE_PRICE_PRO_FOUNDER` |

Annual amounts are 20% under twelve months (the "Save 20%" the page shows):
$129 x 12 x 0.8 = $1,238, $599 x 12 x 0.8 = $5,750. Change them if you want
rounder numbers, but then change `annualPrice` in
`src/app/(billing)/pricing/pricing-plans.ts` to match.

The Pro founding rate of $99 is my suggestion (about 23% under $129). The old
$79 founder price belonged to a $99 plan and must not be reused for a $129 plan
with more in it. There is no Agency founding rate.

Set the new Pro and Agency prices to the same product as before (renamed in
step 1) with recurring billing, tax behaviour as on the existing prices.

## 3. Prices to archive (after the env vars are live and checkout works)

- Pro monthly $99 and Pro annual $950
- Agency monthly $249 and Agency annual $2,390
- Pro founder $79

Archiving only stops new checkouts. Subscriptions already on those prices keep
running and keep billing at their price. Do not delete anything.

## 4. Existing subscriptions

The database holds 13 active subscription rows (1 Solo, 6 Pro, 6 Agency; you
confirmed none are paying). They are on the old price IDs. They are not
migrated and keep working, because their access comes from the `plan` value on
the row (`starter`, `pro`, `agency`), which the new limits are keyed on. The
Stripe webhook only rewrites `plan` when it recognises the price on an update
event, and leaves it alone when it does not, so archiving old prices cannot
downgrade them. Do not run `/api/billing/sync` for these accounts after the
change: it falls back to `starter` for a price it does not know.

## 5. Environment variables (Vercel > Project > Settings > Environment Variables)

Set for Production (and Preview if you test there), then redeploy:

```
STRIPE_PRICE_PRO_MONTHLY=<new Pro $129 monthly price id>
STRIPE_PRICE_PRO_ANNUAL=<new Pro $1,238 annual price id>
STRIPE_PRICE_AGENCY_MONTHLY=<new Agency $599 monthly price id>
STRIPE_PRICE_AGENCY_ANNUAL=<new Agency $5,750 annual price id>
STRIPE_PRICE_PRO_FOUNDER=<new Pro $99 founding price id>
```

Unchanged: `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_ANNUAL`,
`STRIPE_PRICE_STARTER_FOUNDER`. Update `.env.local` to match if you test
checkout locally.

## 6. After deploying

1. Open /pricing signed out. Check the three prices and the founding rates.
2. Start a Stripe test-mode checkout for Pro monthly and confirm the amount is $129.
3. Confirm the webhook writes `plan = pro` for it (Stripe Dashboard > Webhooks > recent deliveries, and the `subscriptions` row).
4. Cancel the test subscription.
