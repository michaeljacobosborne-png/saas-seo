# Fix admin MRR calculation to account for Stripe discounts

- Session `f400bc55-236a-4033-8b3b-7ff751b2d0c2`
- 2026-06-18 18:02 to 2026-06-18 19:18
- Branch: `master`  |  Claude Code 2.1.170

**Files touched (2):** `src/app/(admin)/admin/_lib/admin-data.ts`, `src/app/(admin)/admin/page.tsx`

---


## Michael

Update the admin dashboard MRR calculation to reflect actual collected revenue after Stripe coupons and discounts, not just the plan list price.

## Step 0 — Read first
1. Read `src/app/(admin)/admin/_lib/admin-data.ts` in full — understand the current MRR calculation
2. Read `src/app/(admin)/admin/page.tsx` — understand how MRR is displayed

## What to fix

### Current problem
MRR is calculated as `plan.amount * quantity / (interval === 'year' ? 12 : 1)` for each active subscription. This ignores Stripe discounts — any subscriber on a coupon (percent_off or amount_off) shows inflated MRR.

### Fix: apply discounts to each subscription

Stripe's subscription object includes a `discount` field when a coupon is applied. Structure:
```typescript
subscription.discount?.coupon?.percent_off  // e.g. 50 (means 50% off)
subscription.discount?.coupon?.amount_off   // e.g. 2000 (means $20.00 off, in cents)
```

For each subscription, compute the actual monthly amount:
```typescript
function effectiveMonthlyAmount(sub: Stripe.Subscription): number {
  const item = sub.items.data[0]
  const listPrice = item.price.unit_amount ?? 0
  const qty = item.quantity ?? 1
  const interval = item.price.recurring?.interval
  
  // Gross monthly
  let monthly = (listPrice * qty) / (interval === 'year' ? 12 : 1)
  
  // Apply coupon if present
  const coupon = sub.discount?.coupon
  if (coupon) {
    if (coupon.percent_off) {
      monthly = monthly * (1 - coupon.percent_off / 100)
    } else if (coupon.amount_off) {
      // amount_off is in cents, monthly-equivalent
      const monthlyDiscount = coupon.amount_off / (interval === 'year' ? 12 : 1)
      monthly = Math.max(0, monthly - monthlyDiscount)
    }
  }
  
  return monthly
}
```

Sum these for real MRR.

### Also show on the dashboard
Add a small note/line under the MRR card showing:
- **List MRR** (before discounts): $X
- **Collected MRR** (after discounts): $X  
- **Discount drag**: $X or X%

This makes it immediately obvious how much revenue coupons are costing.

### Also check: per-user MRR in the top accounts table
The top accounts table fetches subscription data for the top 20 users. Apply the same `effectiveMonthlyAmount` logic there so per-user MRR is also accurate.

### Make sure Stripe fetches include discount data
When listing subscriptions with `stripe.subscriptions.list()`, the `discount` field is included by default in the subscription object. No extra `expand` needed — just use `sub.discount` directly.

## After writing
1. `git pull --rebase origin main`
2. Verify only admin data files changed: `git diff --stat HEAD`
3. Commit: `git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Fix admin MRR to reflect actual collected revenue after coupons"`
4. `git push origin main`

**Claude:** I'll start by reading the two files to understand the current MRR calculation.

> `Read: src/app/(admin)/admin/_lib/admin-data.ts`

> `Read: src/app/(admin)/admin/page.tsx`

**Claude:** Now I understand both files. Let me implement the fix in `admin-data.ts` first.

> `Edit: src/app/(admin)/admin/_lib/admin-data.ts`

**Claude:** Now the `getStripeMetrics` body:

> `Edit: src/app/(admin)/admin/_lib/admin-data.ts`

**Claude:** Now round the fractional cents at the return:

> `Edit: src/app/(admin)/admin/_lib/admin-data.ts`

**Claude:** `getTopAccounts` reuses the `customerMrr` map, which now holds collected (post-coupon) amounts — so per-user MRR is automatically accurate with no further change. Now the dashboard display:

> `Edit: src/app/(admin)/admin/page.tsx`

**Claude:** Let me verify types compile, particularly the Stripe `discount` field shape:

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40`

**Claude:** The installed Stripe version uses `discounts` (array), not the singular `discount`. Let me check its shape:

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && grep -rn "discounts" node_modules/stripe/types/Subscriptions.d.ts | head; echo "---DISCOUNT TYPE---"; grep -n "`

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && f=$(ls node_modules/stripe/types/*ubscription*.d.ts 2>/dev/null | grep -iv item | grep -iv schedule | head -1);`

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && ls node_modules/stripe/types/ | grep -i subscri; echo "==="; ls node_modules/stripe/types/ | grep -i discount`

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && find node_modules/stripe -name "Subscriptions.d.ts" -o -name "Subscription*.d.ts" 2>/dev/null | grep -iv item |`

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && grep -rn "discounts:\|Subscription.Discount\b\|namespace Subscription" node_modules/stripe/cjs/resources/Subscr`
