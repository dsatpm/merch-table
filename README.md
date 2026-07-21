# Merch Table

Local-first PWA for tracking merch table sales at shows. No backend, no accounts — everything lives in IndexedDB on the device and works fully offline.

## How it works

- **Stock tab** — set up at home on wifi: items, prices, variants (sizes), starting counts.
- **Sell tab** — two taps per sale: tap the item button, tap Cash or Card/Venmo. Long-press an item for a price override (door deals, bundles). Undo button refunds the last sale.
- **Night tab** — end-of-night summary: units per item, cash vs digital totals, remaining inventory, cash-box reconciliation with discrepancy flag, CSV export, and "Start new night".

## Data model

Every sale is an immutable event (`sale` or `refund`) in an append-only log. Inventory and totals are derived by folding over the log — undo is just appending a refund event, and future multi-device sync becomes append-only log merge.

## Develop

```sh
npm install
npm run dev
```

## Test

TDD project — new behavior starts with a failing test.

```sh
npm test          # full suite once
npm run test:watch
```

Seams under test (tests live at these public boundaries only):

- `src/db.test.ts` — event-log module: sale/refund append semantics, derived stock and totals, night sessions, uuid/device stamps
- `src/migration.test.ts` — v1→v2 schema backfill
- `src/csv.test.ts` — export column contract and escaping
- `src/screens/SellScreen.test.tsx` — taps in, visible totals/readout out: two- and three-tap sales, double-tap debounce, one-tap undo, advisory stock, price override
- `src/screens/NightScreen.test.tsx` — reconcile math (float + cash = expected drawer), night boundary, negative-stock flags

UI tests assert through the rendered screen, never by reading the database — that's the seam.

## Build + deploy

```sh
npm run build
```

`dist/` is fully static — drop it on Cloudflare Pages, Vercel, or any static host. The service worker precaches everything, so after the first visit the app loads with no connection. Install to the home screen from the browser share menu.

Real QA environment: airplane mode.
