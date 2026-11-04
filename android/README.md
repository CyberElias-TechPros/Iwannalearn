# I wanna learn — native Android

This is a Kotlin / Jetpack Compose application. It does **not** contain a WebView, a bundled website, Capacitor, Cordova, or a remote HTML application shell. Screens, navigation, forms, lists, dialogs, settings, account management, checkout state, creator tools and playback controls are native Android UI.

The existing Next.js application remains the server/API and keeps the SQLite database, authentication, pricing, quote, payment, entitlement, upload and notification logic. The Android app talks to its versioned JSON API at `/api/mobile/v1`.

## Open and build

Requirements:

- Android Studio with JDK 21 support.
- Android SDK Platform 36 and Build Tools 36.0.0.
- A running backend (the repository root).
- Android 8.0/API 26 or newer for installation.

Open **this `android/` directory** as the Gradle project, let Android Studio sync, then select the `app` configuration.

Command line:

```sh
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Debug APK:

```text
app/build/outputs/apk/debug/app-debug.apk
```

The GitHub Actions workflow `Android and API` builds the same debug APK and uploads it as an artifact. It also runs native unit tests, Android lint, backend type checking, API tests and a production backend build.

Debug builds use application ID `app.iwannalearn.android.debug`, so they can be installed beside a release build. Debug builds permit HTTP for local development; release builds permit HTTPS only.

## Connect to the backend

Start the server from the repository root:

```sh
npm ci
npm run dev
```

For the standard Android emulator, use this server address in the app:

```text
http://10.0.2.2:3000
```

For a physical device, use an HTTPS development tunnel or a LAN address reachable by the phone. `localhost` on a phone means the phone itself. The connection can be changed in **Account → Connection** or on the sign-in screen. Release builds require HTTPS.

The backend must have a real public HTTPS `SITE_URL` in production. Email links, payment callbacks and Android login returns depend on it.

Demo sign-in appears only when the server is in explicit demo/mock mode. With live payments enabled, use email sign-in. A sign-in email opens the confirmation page at `/auth/android`; the user taps **Continue in the Android app**. The one-time token is exchanged for a revocable bearer session and is not stored in a URL history or notification.

For verified Android App Links, configure `ANDROID_CERT_FINGERPRINTS` on the server with your release certificate's SHA-256 fingerprints. The server then publishes `/.well-known/assetlinks.json`. The custom `iwannalearn://auth` scheme also works, but App Links are preferable for release.

## What is native

- Home, topics, request feed, lesson library, search and pagination.
- Public request detail, timeline, replies, resources, upvotes and follow state.
- Three-step request brief: free/public, priority/public, private commission.
- Draft persistence, native file picker, staged uploads and upload removal.
- Similar-lesson search before submission.
- Quote review/accept/decline and owner-only checkout.
- My requests, saved lessons, followed topics, notification inbox and learning dashboard.
- Account profile, notification preferences, session list, account export/deletion and support.
- Creator Studio: queue, quotes, payments/refunds, library/moderation, inbox, insights and settings.
- Native video player for supported direct media, private-screen protection, creator notes, feedback, revisions and completion confirmation.
- Local cache of public feed/library metadata, saved lesson IDs and notification-read baselines.
- Native system notifications through WorkManager, with request/lesson deep links.
- Share sheet, email handoff, browser handoff and YouTube app handoff.

The app does not pretend that a browser handoff is embedded playback. Public YouTube lessons open the YouTube app or browser because the YouTube Android Player API is deprecated. Direct MP4/HLS media uses Media3. Private commissions require protected direct media, not unlisted YouTube.

## Offline and notification limits

This is a server-backed product, not a fully offline clone. Browsing cached public metadata and saved IDs works offline; submitting requests, signing in, payments, account changes and creator actions require a connection. Video files are not silently downloaded or stored for offline viewing.

WorkManager checks for new notifications about hourly. Android controls the actual schedule using battery/network constraints. This is **not** instant push. For instant push, add an FCM device-token endpoint, send from the backend's existing notification events, and replace the polling worker with Firebase Messaging. No Firebase configuration or service-account secrets are bundled in the app.

## Backend configuration for native private video

New private lessons are published with a direct HTTPS source:

```env
STREAM_SIGNING_SECRET=long-random-secret
STREAM_ALLOWED_HOSTS=media.your-domain.example
SITE_URL=https://your-public-domain.example
ANDROID_CERT_FINGERPRINTS=AA:BB:...
```

`STREAM_ALLOWED_HOSTS` is a comma-separated hostname allowlist. The source must be HTTPS and must not contain URL credentials. The creator's source URL is never included in learner DTOs. The API returns a short-lived, account-bound playback URL to this server; the server rechecks the session, signature and entitlement on every range request, then streams from the allowed upstream. Redirects are rejected and responses are marked `private, no-store`.

Configure the upstream host to serve only to your backend where possible (for example, origin authentication or private object storage plus a backend fetch credential). An ordinary public MP4 URL is not DRM. `FLAG_SECURE` blocks normal screenshots and screen recording on Android, but it cannot stop another camera from recording a screen. Do not promise copy-proof video.

Legacy private YouTube rows remain readable for compatibility, but the native API does not issue protected playback grants for them. Re-publish those lessons as protected direct media before relying on private playback.

## Payments and production gate

The local mock provider exercises the real database path: accepted quote → pending payment → settlement → entitlement → receipt → refund/revocation. Native mock settlement is available only in mock mode, only for the owner, and only for a mock-provider payment.

Paystack/Stripe adapters and webhook verification exist, but live launch still requires your own provider credentials, webhook URL configuration, reconciliation testing, tax/legal review and refund operations. The current live refund adapter does not call a provider refund API; process/confirm live refunds through the provider before enabling that operation for real customers. Do not flip `PAYMENTS_MODE=live` and assume the prototype is a production payment system.

Before Play Store release:

1. Replace demo content/contact details and finalize legal drafts with qualified review.
2. Configure production HTTPS, SQLite persistence/backups, email delivery, payment provider and protected media host.
3. Set release signing credentials outside Git and verify App Links fingerprints.
4. Run native tests/lint, backend tests/build, and device tests on at least API 26, a current API level, slow network, denied notification permission, process death and interrupted upload.
5. Complete Google Play data-safety, account-deletion, privacy-policy, payments and target-API requirements.
6. Build a signed Android App Bundle (`:app:bundleRelease`) and test the Play-internal-testing artifact, not just the debug APK.

## Code map

```text
app/src/main/java/app/iwannalearn/android/
  MainActivity.kt          activity, edge-to-edge setup, intent handoff
  ui/AppRoot.kt            native shell, bottom navigation, deep links, NavHost
  ui/Routes.kt             typed route builders and notification-link allowlist
  ui/screens/              learner and creator screens
  ui/FeatureViewModels.kt  screen state and operations
  ui/PlatformActions.kt    native share/email/browser/file-picker helpers
  player/                  Media3 player and private-window protection
  network/                 DTOs, bearer API client, multipart upload
  data/                    encrypted session, preferences, Room cache, repository
  notifications/           WorkManager polling and native notifications
```

`android/app/src/test` contains unit tests for server validation, request validation, deep-link allowlisting and JSON contracts. The backend's `tests/mobile-api.test.ts` covers authentication, privacy, creator authorization, idempotent intake, quote/payment gates and playback revocation.

## Security choices

- Bearer sessions are stored with Android Keystore-backed encrypted storage, not WebView cookies or plaintext preferences.
- The client never receives payment-provider secret keys, other users' email addresses, creator-only notes, upload storage keys or private upstream media URLs.
- Server-side DTO allowlists are used instead of serializing whole database rows.
- Prices, private visibility, entitlements and role checks are enforced by the server, not trusted from the client.
- Release networking is HTTPS-only; debug cleartext is isolated in the debug source set.
- Backups are disabled in the manifest to avoid exporting local session state through Android backup.
- CI rejects WebView/Capacitor/Cordova imports in the Android source.

Bundled fonts are Fraunces and Instrument Sans under the SIL Open Font License; their license files are in `android/licenses/`.
