<div align="center">
    <img src="/public/splash-logo.svg" />
</div>

Merch Table is an app for tracking merch sales at shows. There's no backend and no accounts. All your data is saved in IndexedDB on your device, and the app works fully offline. It runs as a web app (PWA, hosted on Cloudflare Pages) and as native iOS and Android apps (built with Capacitor). All three come from the same React code, so there's no separate native version to maintain.

## How it works

- **Stock tab:** set this up at home before the show. Add your items, prices, sizes or colors, and how many of each you're bringing.
- **Sell tab:** each sale takes two taps. Tap the item, then tap Cash or Card/Venmo. To change the price for one sale (a door deal or a bundle), press and hold the item. The undo button takes back the last sale.
- **Night tab:** your end-of-night summary. It shows how many of each item you sold, your cash and card totals, what's left in stock, and a cash box check that tells you if the cash doesn't match. You can also export a CSV and start a new night from here.

## How the data works

Every sale is saved as an event (`sale` or `refund`) that never changes once it's written. Events are only ever added to the log, never edited or deleted. Inventory counts and totals are worked out by adding up the log. Undo works by adding a refund event instead of deleting the sale. This also means syncing between devices later can be as simple as merging logs.

## Run it locally

```sh
npm install
npm run dev
```

## Testing

This project uses test-driven development, so new behavior starts with a failing test.

```sh
npm test            # run the full suite once
npm run test:watch  # rerun tests as you edit
```

Tests only check behavior at these public boundaries:

- `src/db.test.ts`: the event log. Adding sales and refunds, stock and totals worked out from the log, night sessions, and uuid/device stamps.
- `src/migration.test.ts`: the v1 to v2 database upgrade that fills in missing fields on old rows.
- `src/csv.test.ts`: the CSV export columns and how special characters are escaped.
- `src/screens/SellScreen.test.tsx`: taps go in, totals and the last-sale readout come out. Covers two- and three-tap sales, ignoring accidental double taps, one-tap undo, stock warnings, and price changes.
- `src/screens/NightScreen.test.tsx`: the cash box math (starting cash plus cash sales equals what should be in the box), where one night ends and the next begins, items that sold below zero, starting a new night, and sharing the summary.
- `src/screens/StockScreen.test.tsx`: the stock list and the item editor (adding, editing, sizes, deleting, canceling, and form checks).
- `src/Sheet.test.tsx`: the bottom sheet used for every pop-up.
- `src/Onboarding.test.tsx`: the first-run walkthrough.

UI tests check what shows up on screen. They never read the database directly.

## Build and deploy

```sh
npm run build
```

The `dist/` folder is fully static, so you can put it on Cloudflare Pages, Vercel, or any static host. The service worker saves every file on the first visit, so after that the app loads without a connection. To install it, open the browser's share menu and add it to your home screen. The live version is at merch-table.pages.dev.

The real test for this app is turning on airplane mode.

## Native apps (iOS and Android)

The native apps are the same React app wrapped with [Capacitor](https://capacitorjs.com). Anything that only works on native (status bar, splash screen, haptics) lives in `src/native.ts` and only runs when `Capacitor.isNativePlatform()` is true, so the web version isn't affected. The bundle ID is `com.htpdevs.merchtable`.

```sh
npm run ios:open       # build the web files, sync, and open Xcode
npm run android:open   # build the web files, sync, and open Android Studio
npm run cap:sync       # build and sync without opening an IDE
```

After you change anything in `src/`, run `cap:sync` (or one of the `:open` scripts) before testing on a phone. The native apps don't use the dev server. They run the built `dist/` files, which get copied into `ios/App/App/public` and `android/app/src/main/assets/public`.

**iOS:** you need the full Xcode app, not just the Command Line Tools, to build, sign, or run the simulator. The project doesn't use CocoaPods. Capacitor 8 pulls in plugins with Swift Package Manager the first time you open the project in Xcode, which needs an internet connection once.

**Android:** you can build from the command line with just the Android SDK and a Java 17 to 21 JDK. If your system JDK is newer than that, use the JDK that comes with Android Studio, since Gradle doesn't support the newest JDKs yet:

```sh
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

**Updating icons and splash screens:** the source images are `assets/icon.png` (1024×1024) and `assets/splash.png` (2732×2732, the logo scaled up with no padding). Splash screens don't need padding because each device crops them to fit. The PWA icon is different, since it needs a strict safe zone. After you replace either file, run `npm run assets:generate`. It rebuilds every size for both platforms. It also writes a PWA icon set to `icons/`, but this project doesn't use it. The web icons are hand-tuned in `public/` and set up in `vite.config.ts`, so don't copy the `icons/` output over them.

**Known issue:** the Android back button uses Capacitor's default behavior, which closes the app. That's correct on the main screen, since the app is a single page with tabs and nothing to go back to. But it should close any open pop-up first (the item editor, price change, onboarding, and so on), and right now it closes the app instead. Fixing this needs one shared place that tracks which pop-up is open, and that hasn't been built yet.
