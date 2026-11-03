# BB Manager — Enterprise Restaurant Pickup & Operational Terminal

Employee-facing terminal for kitchen leads, counter staff and branch managers. It covers local
pickups, dining-table capacity, website reservations, live menu stock and store-level operations
across multiple branches.

The app is a pure React Native + Expo SDK 58 TypeScript project. The earlier Jetpack Compose
prototype has been removed; Expo Router owns navigation, PocketBase owns realtime data, and
Expo SQLite keeps the floor working offline.

## Stack

- **Expo SDK 58 / React Native 0.88 / React 19** with the New Architecture enabled.
- **Expo Router** file-based routing under `src/app`.
- **Strict TypeScript** (`strict: true`) across screens, components, services and state.
- **PocketBase** JS SDK with an AsyncStorage-backed `AsyncAuthStore` and SSE subscriptions.
- **Expo SQLite** for local snapshots and the durable offline outbox.
- **Expo Audio** for ten bundled, offline alert tones with in-settings previews.
- **Jest + ts-jest** for the domain, analytics, mapper, sync-outbox, reducer and formatting suites.

## Screens

| Route | Module |
| --- | --- |
| `src/app/(app)/index.tsx` | Orders Board — live tickets, PIN hand-off, filters, tablet split view |
| `src/app/(app)/menu/index.tsx` | Menu & Stock — two-column grid, stock toggles, full item editor with 1:1 photo crop |
| `src/app/(app)/tables.tsx` | Dining Tables — Guest Reservations default view, Update Tables management mode, booking master switch |
| `src/app/(app)/reservations.tsx` | Reservations — view-only booking ledger with the arrived toggle |
| `src/app/(app)/pickup-orders.tsx` | Pickup Ledger — historical, read-only audit |
| `src/app/(app)/analytics.tsx` | Floor Analytics — Today / Week / Month / custom date windows, dynamic KPIs, peak hours, ticket distribution |
| `src/app/(app)/settings.tsx` | Terminal Settings — store operations, weekly hours, SMTP, notifications, order alert tones, delivery URLs, branch/staff access |
| `src/app/login.tsx` | Staff sign-in with branch-code scoping |

The compact icon-only footer has five primary destinations (Orders, Menu, Tables, Analytics,
Settings). Guest Reservations is the default view inside Dining Tables, switchable to table
management with Update Tables. The pickup ledger opens from the Orders header, so every module keeps
the footer visible.

## Architecture

```
src/
  app/                 Expo Router routes (root stack, login, (app) group + footer)
  components/          Shared Material 3 dark UI (cards, chips, modals, nav, header)
  constants/           Branch directory and demo credentials
  db/sqlite.ts         Cache snapshots + outbox queue (WAL)
  hooks/useNow.ts      Ticking clock for ticket timers
  lib/                 Pure domain: filters, analytics, formatting, seed data
  services/            PocketBase client, record mappers, SSE, alert-tone playback, outbox sync, auth
  state/               Typed reducer + AppProvider (hydration, realtime, mutations)
  theme/               Charcoal palette, type ramp, spacing, radius, 48dp touch target
  types/               Shared domain interfaces
__tests__/             Jest suites for pure logic
```

### Local cache and offline outbox

`src/db/sqlite.ts` stores JSON snapshots (`orders`, `analytics_history`, `menu_items`,
`tables`, `reservations`, `branch_settings`, `terminal_settings`) in `bb_manager_local.db`
and writes every mutation to `outbox_queue`. The analytics ledger covers 365 days and stays out of
the live Orders board; Floor Analytics merges the live board and the ledger by record ID so a ticket
is never counted twice. The provider replays the outbox oldest-first (including automatically after
connectivity returns); a failed PocketBase request stays queued, and the connection badge reports
`OFFLINE QUEUED` with the pending count.

### Realtime

`src/services/realtime.ts` subscribes to the `orders`, `menu_items`, `tables`,
`reservations` and `branch_settings` collections. Events are mapped into typed records and
upserted into app state. With no `EXPO_PUBLIC_POCKETBASE_URL` the terminal runs in local demo mode
(no network calls) while keeping SQLite as the source of truth.

### Order alerts

Terminal Settings → Sync & Data Health includes a persisted audio switch and an Order Alert Tone
picker. Ten locally bundled WAV presets (Classic Chime, Kitchen Bell, Digital Beep, Loud Alarm,
Subtle Ping, Double Gong, Restaurant Order Chime, High Pitch Alert, Marimba and Urgent Pulse) each
have a play/stop preview button. The chosen tone is written through `saveTerminalSettings` to SQLite
and reapplied on hydration, so it survives restarts. New PocketBase SSE orders with `new` status and
locally simulated demo orders trigger the selected tone. Web playback follows the browser's autoplay
policy; a preview tap first unlocks audio in browsers that block sound before interaction.

## PocketBase collections

- **staff_users** — `email`, `name`, `role` (`manager` | `kitchen_lead` | `floor_staff`), `branch_id`
- **branches** — `name`, `code`, `address`, `phone`, `is_active`
- **orders** — `order_number`, `branch_id`, `customer_name`, `customer_phone`, `status`, `items`,
  `total_amount`, `pickup_code`, `notes`, `channel`, `estimated_pickup_at`
- **menu_items** — `branch_id`, `name`, `category`, `description`, `price`, `currency`, `in_stock`,
  `is_visible`, `prep_minutes`, `image_url`, `modifiers`, and an `image` file field for the 1:1
  cropped dish photo. Removing a photo clears `image` on PocketBase and falls back to the placeholder.
- **tables** — `branch_id`, `table_number`, `name`, `capacity`, `is_available`, `zone`
- **reservations** — `branch_id`, `customer_name`, `customer_phone`, `guest_count`,
  `reservation_time`, `table_number`, `status`, `special_requests`
- **branch_settings** — one row per branch combining operations and terminal configuration:
  `branch_id`, `branch_name`, `is_open_for_orders`, `opening_time`, `closing_time`,
  `slot_interval_minutes`, `accepting_pickups`, `accepting_reservations`, `weekly_schedule`
  (all 7 days), `smtp_host`, `smtp_port`, `smtp_username`, `smtp_password`, `smtp_encryption`,
  `smtp_from_email`, `smtp_from_name`, `notifications_active`, `notification_recipients`,
  `delivery_web_url`, `delivery_wolt_url`, `delivery_glovo_url`, `delivery_pyszne_url`,
  `delivery_uber_eats_url`, `alert_tone_id`, `sound_alerts_enabled`, `staff_roster`

> Existing deployments that used the earlier `dining_tables` and `store_operations`
> collections must migrate those rows to `tables` and `branch_settings`; the terminal
> only reads and writes the canonical collection names above.

## Setup

This app uses native modules (`expo-sqlite`, `expo-audio`, `expo-image-picker`) that are **not
available in Expo Go**. You must use a custom development build.

### Prerequisites

- Node.js 18+ and npm
- Android Studio (for Android builds) or Xcode (for iOS builds)
- Java 17+ and Android SDK 34+ (for `npx expo run:android`)
- Optional: [EAS CLI](https://docs.expo.dev/eas/) for cloud builds (`npm i -g eas-cli`)

### Install dependencies

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` and set your PocketBase URL:

```bash
EXPO_PUBLIC_POCKETBASE_URL=https://pocketbase.example.com
```

Without a URL the app runs the local demo dataset, which is also what the tests use.

### Build and run locally (recommended)

Generate the native projects and launch a development build on a connected device or emulator:

```bash
# Android
npm run prebuild:android    # regenerate android/ with current plugin config
npm run dev:android         # build + install + start Metro with --dev-client

# iOS
npm run prebuild:ios        # regenerate ios/ with current plugin config
npm run dev:ios             # build + install + start Metro with --dev-client
```

`npx expo run:*` compiles the native binary, installs it on the target, and starts Metro with
`--dev-client` so the dev launcher connects automatically. Subsequent JavaScript-only changes
reload through Metro without rebuilding; run `prebuild:*` again after changing `app.json`
plugins or native dependencies.

### EAS Development Build (cloud or local)

If you don't have the native toolchain installed, use EAS Build to produce a development client:

```bash
eas login
eas build --profile dev:development --platform android   # produces an APK
eas build --profile dev:development --platform ios       # produces a simulator build
```

Install the resulting artifact on your device/simulator, then start Metro locally:

```bash
npm start   # aliased to `expo start --dev-client`
```

The dev launcher will prompt for the Metro URL; accept the default or enter your LAN IP when
testing on a physical device.

### Web

Web uses the WASM build of `expo-sqlite` and does not require a native build:

```bash
npm run web
```

Ensure the page is served over HTTPS or localhost so `SharedArrayBuffer` is available. The
Metro dev server already sends the required COOP/COEP headers; replicate them in production
hosting.

## Verification

```bash
npx tsc --noEmit        # zero TypeScript errors
npm test                # ids, mappers, domain, analytics, reducer, formatting and alert-tone suites
```

## Troubleshooting sync ("OFFLINE QUEUED")

The outbox badge reflects connectivity plus queue health:

- `OFFLINE QUEUED` — the host was unreachable (network/TLS). Entries retry every 30 s.
- `POLLING` + `N queued` — PocketBase answered but **rejected** the writes. This is a
  rules/auth problem, not a network problem; the queue will never drain by itself.
- `SSE LIVE` — writes are landing.

Run the in-app probe: **Settings → RUN SYNC DIAGNOSTICS**. It force-flushes the queue and
prints the endpoint, token expiry, staff role, branch, HTTP status, PocketBase message,
per-field validation detail and a hint for every rejected entry (`adb logcat` or the
`expo start` console).

Or reproduce the same traffic from a workstation:

```bash
node scripts/diagnose-sync.mjs --email <staff email> --password '<password>'
```

The script checks `/api/health`, logs in, verifies the `branch_id` claim, lists the branch
menu, then creates / reprices / deletes a temporary item using the exact payload the
outbox sends — and prints the server's rejection verbatim.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `kind=rule status=400 "Failed to create record."` on `CREATE_MENU_ITEM` | `menu_items.createRule` allows `manager`/`kitchen_lead` only — `floor_staff` can never create | sign in as a manager, or promote the account |
| `kind=auth status=401` / `kind=forbidden status=403` | staff token expired (PocketBase issues 5-day tokens) or account disabled | sign out and sign in again |
| `kind=not-found status=404` on an update | the item's create never landed, so the record does not exist | clear the failed create first, then re-edit |
| `kind=validation` with field detail | payload/ID constraint (IDs must be 15 lowercase alphanumerics) | fix the field named in `detail` |
| `OFFLINE QUEUED` with `status=0` | device cannot reach the host (DNS/TLS/Cloudflare) | check the device network and the tunnel |

### Jammed queue (dead records, 404s)

A permanently rejected mutation is now dead-lettered instead of retried forever:

- **Dropped automatically**: `404 Not Found` (the record was deleted on PocketBase) and
  `400` field-validation errors. The entry is removed from SQLite and state, logged as
  `[sync] DISCARDED … | removed from queue (permanent)`, and listed in
  Settings → RUN SYNC DIAGNOSTICS under "Dropped N permanently rejected action(s)".
- **Still retried**: network/timeout, `401`/`403` (re-login fixes them) and `400` rule
  denials (role/branch — the UI now prevents those writes).
- **Manual escape hatch**: Settings → **CLEAR STUCK QUEUE** (confirmation required) wipes
  every pending mutation, sets the connection back to live and re-subscribes SSE.

Offline recovery: while the connection is `OFFLINE`, the 30 s retry tick first calls
`GET /api/health` (6 s timeout). A success flips the badge to `SSE LIVE`, rebuilds the
realtime subscriptions that failed while the host was down, and immediately resumes the
queue; a successful flush also flips `OFFLINE → LIVE` on its own.

Role capabilities enforced on both sides:

| Action | manager | kitchen_lead | floor_staff |
| --- | --- | --- | --- |
| Create menu item | ✅ | ✅ | ❌ |
| Rename / recategorise / photo | ✅ | ❌ | ❌ |
| Price, stock, visibility | ✅ | ✅ | ✅ |

The UI hides "+ ADD ITEM" and disables name/category/description/photo for roles that
PocketBase would reject, so those mutations are never queued.

### Expo Go: "network 0 / PocketBase is unreachable" while the browser works

`status 0` means the request never produced an HTTP response — the SDK wrapped a
transport exception (`TypeError: Network request failed` on Android). Work through these:

1. **Check the bundle URL.** The startup log prints `[pb] base URL: …`. Expo inlines
   `EXPO_PUBLIC_*` at bundle time, so after editing `.env` restart with
   `npx expo start -c`. A `127.0.0.1`/`localhost` value can never work from a phone
   (the app logs a warning).
2. **Run Settings → RUN SYNC DIAGNOSTICS.** The report includes `raw-health` (plain
   `fetch`, no SDK), `redirect-health` (the `//api` 307 path), `raw-post-auth` (POST
   reachability) and, when the host fails, `control-https` (a neutral Cloudflare host).
   The verdict line names the failure class:

   | Result | Meaning | Action |
   | --- | --- | --- |
   | `raw-health` 200, SDK 0 | SDK-only failure | report with the `[pb:req]`/`[pb:res]` logs |
   | `raw-health` 0, `control-https` 200 | general HTTPS works, this host does not answer | Cloudflare/WAF is challenging the app client — allow the tunnel API path for non-browser clients |
   | `raw-health` 0, `control-https` 0 | no HTTPS at all from the app | device VPN / Private DNS / proxy / TLS interception |
   | `redirect-health` 307 without a body | RN did not follow the redirect | remove the trailing slash from the configured URL |

3. **Get the native cause.** React Native collapses DNS, TLS and connection-reset
   errors into `TypeError: Network request failed`; JavaScript cannot see more.
   Use `adb logcat | grep -iE "okhttp|ssl|cleartext|pocket"` while running the probe.

Requests now time out after 20 s (`POCKETBASE_REQUEST_TIMEOUT_MS`) instead of freezing
the outbox flush, and dev builds log every SDK call as `[pb:req]` / `[pb:res]`.

## Design system

- Background `#121212`, cards `#262626`, header/sheets `#1E1E1E`, hairline `#333333`
- Indigo `#6366F1`, amber `#F59E0B`, emerald `#10B981`, soft red `#EF4444`
- 8pt spacing grid, 48dp minimum touch targets, horizontal filter chips on Orders, Menu,
  Reservations and the ledger, and an icon-only glowing footer.
