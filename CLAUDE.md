# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repo.

## What this is

Local-first PWA, track merch table sales at shows. No backend, no accounts — everything live IndexedDB on device, work fully offline. Real QA env: airplane mode.

## Commands

```sh
npm run dev          # start vite dev server
npm run build         # tsc -b type check, then vite build (dist/ is fully static)
npm run preview       # preview production build
npm test              # vitest run — full suite once
npm run test:watch    # vitest watch mode
```

Run single test file: `npx vitest run src/db.test.ts` (or any path). Filter by name: `npx vitest run -t "test name"`. TDD project — new behavior starts with failing test.

## Architecture

### Event-sourced data model (src/db.ts)

Every sale immutable event (`sale` or `refund`), appended to event log in Dexie (IndexedDB wrapper). Inventory counts and totals **derived** by folding over log, not stored directly:

- Undo: appends `refund` event pointing at original sale via `refundOf`, not deleting sale.
- Every event stamped with `uuid` and `deviceId` (see `getDeviceId()`) — future multi-device sync can be simple union-by-uuid merge, no conflict resolution needed.
- Schema changes go through Dexie's versioned `db.version(n).stores(...).upgrade(...)` — see v1→v2 migration in `src/db.ts` for pattern (backfill `uuid`/`deviceId` on old rows).

Three tables: `items` (name, price, variants/sizes, sortOrder), `events` (append-only sale/refund log), `settings` (key/value).

### Screens (src/screens/)

Three-tab structure, each reading/deriving from same event log:

- **StockScreen** — setup: items, prices, variants, starting counts.
- **SellScreen** — two taps per sale (item, then Cash or Card/Venmo). Long-press for price override. Undo button appends refund event for last sale.
- **NightScreen** — end-of-night derived summary: units per item, cash vs digital totals, remaining inventory, cash-box reconciliation with discrepancy flag, CSV export (src/csv.ts), "Start new night".

### Test seams

Tests only assert at these public boundaries — never by reaching into database directly from UI tests:

- `src/db.test.ts` — event-log module: append semantics, derived stock/totals, night sessions, uuid/device stamps
- `src/migration.test.ts` — v1→v2 schema backfill
- `src/csv.test.ts` — export column contract and escaping
- `src/screens/SellScreen.test.tsx` — through rendered UI: taps in, totals/readout out (two/three-tap sales, debounce, undo, advisory stock, price override)
- `src/screens/NightScreen.test.tsx` — reconcile math, night boundary, negative-stock flags, start-new-night sheet, share summary (clipboard + fallback sheet)
- `src/screens/StockScreen.test.tsx` — list left/start counts, item editor sheet (add, edit, add/remove variant, delete, cancel, validation)
- `src/Sheet.test.tsx` — bottom sheet: portal, exit animation leaves a11y tree immediately, reopen mid-exit, backdrop close, keyboard inset

New screen-level tests: assert through rendered output (`@testing-library/react`), not by reading `db` state directly. `src/test/setup.ts` wires jsdom + `fake-indexeddb` for Dexie in tests.

### UI design system

Mobile only (iOS/Android via Capacitor, PWA on phones), dark only. No desktop layouts. Tokens + every component style live in `src/styles.css`:

- Colors, radii, easing, z-layers are CSS custom properties on `:root` — use them, don't hardcode. Background `#08090b` is mirrored in `capacitor.config.ts`, `src/native.ts`, `index.html`, `vite.config.ts`; change all together.
- Fonts: Geist + Geist Mono variable woff2, vendored in `src/fonts/` (OFL) so they work offline. No CDN fonts.
- Icons: hand-drawn hairline set in `src/icons.tsx` (1.5 stroke, `aria-hidden`). Accessible names go on the button, never the icon.
- Modals: always `Sheet` (`src/Sheet.tsx`), a bottom sheet portaled to `<body>` that lifts above the keyboard via `--kb`.
- Containers: `.bezel` (outer tray) + `.bezel-core` (inner plate). Entry motion: `.reveal` + `style={stagger(i)}` (`src/stagger.ts`). Animate only `transform`/`opacity`; `.reveal` uses `backwards` fill so `:active` press transforms still apply.
- Sell is a fixed layout: totals, scrolling grid, docked pay buttons (`main.is-fixed`). Keep the dock in thumb reach.

### PWA / build

`vite-plugin-pwa` (see `vite.config.ts`) autoUpdates service worker, precaches build assets. `merch-table.png` (raw 1.7MB source logo) deliberately excluded from precache via `globIgnores` — don't remove exclusion when touching workbox config. `dist/` static bundle, deployable to any static host (Cloudflare Pages, Vercel, etc).

## Caveman mode

Repo has always-on caveman-style terse-response rule installed for AI agents (`.cursor/rules/caveman.mdc`, `.windsurf/rules/caveman.md`, `.clinerules/caveman.md`, `.github/copilot-instructions.md`, `.opencode/AGENTS.md`, `AGENTS.md`). Governs conversational tone only (drop articles/filler/pleasantries) — code, commits, PRs still written normally. See any of those files for full rule set.