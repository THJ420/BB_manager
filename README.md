# BB Manager

Employee mobile app for the multi-branch pickup system. Branch staff sign in with PocketBase, receive live new-order alerts, update order statuses (including offline), and manage menu price/availability.

## Stack

- **App:** Expo SDK 58, Expo Router, TypeScript, React Native 0.88
- **Local data:** Expo SQLite (cache, outbox, alert dedupe)
- **Realtime:** PocketBase SSE via `react-native-sse`
- **Alerts:** `expo-audio` looping siren, full-screen overlay, Android local notifications
- **Backend:** PocketBase v0.40.6 (`https://pocket.enjoydonerkebab.pl`) + Laravel/Filament (`https://radhuni.pl/super_admin`)

## How it fits together

```
Customer website -> Laravel order (pending)
                         |
                         | superuser REST push after commit
                         v
                    PocketBase ---- SSE ----> BB Manager app
                         ^                       |
                         |                       | status / price / stock
                         +---- signed webhook --+
                              (raw-body HMAC)
```

- PocketBase is the app's direct backend and realtime bus.
- Laravel remains the order creator and the website data source.
- `branch_id` from the authenticated PocketBase user scopes every query, subscription and cached row.
- Offline writes go into a single-flight SQLite outbox and are replayed with backoff.

## Quick start

```bash
npm install
cp .env.example .env          # EXPO_PUBLIC_PB_URL
npm run make-siren            # regenerates assets/sounds/new-order.wav
npx expo start                # Expo Go / dev client
# or a native development build:
npx expo run:android
```

Preview APK (requires an Expo account and `eas init`):

```bash
npx eas-cli@latest build -p android --profile preview
```

> The app is SDK 58. If the installed Expo Go does not support SDK 58, use a development or preview APK.

### Demo login

A demo branch, four demo menu items and one pending demo order were seeded. The demo staff credentials are in `.seed.local.json` (gitignored, never committed). Delete the demo account/data before production.

## Branch and security model

- PB `users`: self-registration closed; staff can only update their own record; a hook blocks changes to `role`, `branch_id`, `email`, `verified` and `tokenKey`.
- PB `orders`: branch-scoped read/update; create/delete are superuser-only; non-superusers can only change `status`, and only through the allowed transitions.
- PB `menu`: branch-scoped read/write; staff can only change `price` and `is_available`; managers/admins may also edit content fields.
- PB `branches`: staff can read only their own branch.
- `orders.idempotency_key` is optional. Both databases use a **partial unique index** (`WHERE idempotency_key IS NOT NULL AND idempotency_key <> ''`), so any number of unkeyed orders coexist while duplicate non-empty keys are rejected.

## Backend deployment checklist

The local code changes are complete and runtime-tested. To activate them on the live hosts:

1. **PocketBase** (`I:\pocket.edk.pl`)
   - Restart the container so the migrations and hooks load:
     ```bash
     docker compose up -d pocketbase
     ```
   - Ensure `I:\pocket.edk.pl\.env` contains:
     ```env
     BB_LARAVEL_HOOK=https://radhuni.pl/super_admin/api/internal/pb
     BB_SYNC_SECRET=<same secret as Laravel PB_SYNC_SECRET>
     ```
   - Migrations applied: branch-scoped rules, closed signup, optional idempotency key, partial unique index, menu/order indexes.
   - The host port `127.0.0.1:8090` is currently occupied by Wondershare's notification service. Use the public HTTPS URL or the Docker network for local checks.

2. **Laravel** (`I:\Radhuni 2.0\radhuni2.0\super_admin`)
   - Deploy the changed/new files and run `php artisan migrate`.
   - Set on the live `.env`:
     ```env
     PB_ENABLED=true
     PB_URL=https://pocket.enjoydonerkebab.pl
     PB_IDENTITY=<PocketBase superuser email>
     PB_PASSWORD=<PocketBase superuser password>
     PB_AUTH_COLLECTION=_superusers
     PB_TIMEOUT=4
     PB_SYNC_SECRET=<same secret>
     PB_BRANCH_ID=<branches.id>    # optional if settings.pocketbase_branch_id is set
     ```
   - Set the branch in Filament Settings or `settings.pocketbase_branch_id`; the syncer prefers the settings value.
   - Run `php artisan pocketbase:backfill-menu` once to link/create PocketBase menu records.
   - Repair commands:
     - `php artisan pocketbase:pull-menu` — PB → Laravel menu safety net.
     - `php artisan pocketbase:pull-orders` — PB → Laravel status safety net (use if a webhook is missed).
     - `php artisan pocketbase:resync-orders --since="..."` — Laravel → PB order repair.
   - The new internal endpoints are `POST /super_admin/api/internal/pb/menu` and `/orders/status`, protected by a raw-body HMAC (timestamp + body, 300 s window).
   - **The live endpoint currently returns 405** because the new Laravel code is not deployed there yet. Verify after deployment:
     ```bash
     curl -i -X POST https://radhuni.pl/super_admin/api/internal/pb/menu
     # expect 401 (route exists, signature missing), not 405
     ```

3. **Cloudflare**
   - The public PocketBase host is behind Cloudflare. A Python client was challenged with error 1010, while curl succeeded. Verify the Android app, the Laravel server-to-server client and the PocketBase hook are all allowed:
     - Add a WAF skip/allow rule for `/super_admin/api/internal/pb/*` (still HMAC-protected).
     - Add an allow rule for the PocketBase API paths used by the app and by Laravel, or place the API behind a bypass/allowlisted client.
   - If Cloudflare blocks a client, the app cannot sign in or the mirror/reverse sync will fail. Test from the actual counter device.

## Verification performed

App:

```bash
npm run typecheck      # clean
npm test               # 24 tests pass
npx eslint .           # clean
npx expo-doctor        # 20/20 checks pass
npx expo export --platform android
```

Backend (live, temporary data cleaned up):

- PB staff branch isolation, role/branch escalation block, closed signup, order status transitions, nullable idempotency keys and duplicate-key rejection — all pass.
- PB hook HMAC verified against a receiver: menu and order-status webhooks both `PASS`.
- Laravel migration verified on a temporary SQLite DB; two NULL keys coexist, `''` normalizes to NULL, duplicate keys fail.
- Laravel reverse-sync controllers update menu/order records.
- Raw-body signature accepted; altered body and stale timestamps rejected (401).
- Original order indexes survive the column-change migration.

## Known limitations

- Alerts work while the app is running (foreground SSE/local notification). There is no remote push when the app is closed; keep the counter device on the Orders tab.
- SSE is backed by a 30 s polling fallback because Cloudflare can close idle streams. The connection badge shows `Live`/`Polling`/`Offline`.
- Menu images are not mirrored from Laravel in v1.
- The PocketBase auth token is stored in AsyncStorage (plaintext at rest). A SecureStore-backed store is the upgrade path.
- On-device UI, audio and notification behavior could not be exercised in this environment (no Android emulator/device connected). The Android JS bundle succeeds; validate on the counter device before go-live.
- Demo data is intentionally labeled (`Demo …`, `DEMO Customer`) and must be removed before production.
