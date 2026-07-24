# Tests

Pure-function unit tests, using Node's built-in test runner. No dependencies, no `package.json`, no build step — matches the rest of this app.

```bash
node --test
```

## Scope

Currently covers `js/utils.js` — ID normalization, money formatting, `splitEven` (the bulk-purchase shipping/gas allocator), HTML/URL escaping, CSV export.

Not covered: the DOM-coupled calculation functions (`calcPurchaseCost`, `calcSaleProfit`, `calcExpenseCost` in `js/purchases.js`/`js/sales.js`/`js/expenses.js`) — they read directly from `document.getElementById(...)` and write results back into the DOM, so they aren't pure functions as written. They'd need a small refactor (extracting the actual math into a pure core, with the DOM reads/writes as a thin wrapper) to be testable this way. Worth doing given they're the app's actual profit/margin math, but that's a separate, deliberate change to production code, not just adding tests — ask before doing it.

Also not covered: anything that talks to Supabase, role/RLS enforcement (that's tested at the database level via `pg_policies`, not here), or UI/rendering behavior.
