# Game Zone — PS4/PS5 Monitoring App

A cross-platform app for managing a game zone business. Track consoles, sessions, players, expenses, and analytics. Supports web (PWA), Android, iOS, and Electron.

## Tech Stack

- React + Vite
- Firebase Authentication (email link OTP + Google OAuth)
- Capacitor (Android / iOS)
- Tailwind CSS + shadcn/ui
- localStorage / Capacitor Preferences (data storage)

## Getting Started

1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your Firebase config
4. Run: `npm run dev`

## Environment Variables

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_MEASUREMENT_ID=
# Comma-separated Firebase UIDs that get admin role on first login
VITE_ADMIN_UIDS=
```

## Authentication

Users log in via:
- **Email link (OTP)** — enter email, receive a magic link, click to sign in
- **Google OAuth** — one-click sign in with Google account

### Google OAuth setup

In Firebase Console:
1. Go to `Authentication` → `Sign-in method`
2. Enable **Google** sign-in
3. Go to `Authentication` → `Sign-in method` → `Authorized domains`
4. Add `localhost` for local development and your production domain(s)

If you see `auth/unauthorized-domain`, it means the app's current domain is not listed in Firebase authorized domains.

## Roles

- `admin` — full access (financial data, expenses, analytics, console/player management)
- `user` — operational access (start/end sessions, view consoles and players)

Admin UIDs are set via `VITE_ADMIN_UIDS` in `.env`. The first user whose UID matches gets admin role automatically on first login.

## Native Platform Setup

### Required Native Asset Files

These files contain sensitive credentials and **must not be committed** to the repository. They must be provided per-environment (CI secrets or local developer setup).

| File | Platform | Purpose |
|------|----------|---------|
| `android/app/google-services.json` | Android | GoogleAuth / Firebase on Android |
| `ios/App/App/GoogleService-Info.plist` | iOS | GoogleAuth / Firebase on iOS |

**How to obtain them:**
1. Go to the [Firebase Console](https://console.firebase.google.com/) → your project → Project Settings
2. Under "Your apps", download `google-services.json` for Android and `GoogleService-Info.plist` for iOS
3. Place each file at the path shown above

> Without these files, `@codetrix-studio/capacitor-google-auth` will throw at runtime on the respective platform. The Android `build.gradle` conditionally skips the Google Services plugin when `google-services.json` is absent, so the build will succeed but auth will fail at launch.

A pre-build warning script (`scripts/check-native-assets.mjs`) runs automatically before `npm run build:android` and warns if these files are missing.

### Android SDK Requirements (Capacitor 8.x)

Verified in `android/variables.gradle`:

| Setting | Value | Requirement |
|---------|-------|-------------|
| `minSdkVersion` | 24 | >= 23 ✅ |
| `targetSdkVersion` | 36 | >= 34 ✅ |
| `compileSdkVersion` | 36 | >= 34 ✅ |

### Required Android Permissions

Declared in `android/app/src/main/AndroidManifest.xml`:
- `INTERNET` — required for all network calls and Capacitor WebView
- `ACCESS_NETWORK_STATE` — network connectivity checks
- `VIBRATE` — haptic feedback

GoogleAuth does not require additional Android permissions beyond `INTERNET`.

## Build

```bash
npm run build          # web
npm run build:android  # web build + cap sync android (warns if google-services.json absent)
npx cap sync           # sync to Android/iOS
npx cap open android   # open in Android Studio
npx cap open ios       # open in Xcode
```

`npm run build`, `npm run build:web`, and `npm run build:electron` now fail fast if required Firebase variables are missing (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`).  
For exceptional local troubleshooting only, you can bypass this with `SKIP_FIREBASE_ENV_CHECK=1`.

## Cloudflare Pages Deployment

This app is released via Cloudflare Pages only. Remove any Netlify integration before release.

1. Connect your GitHub repo to Cloudflare Pages.
2. Set the build command to `npm run build`.
3. Set the output directory to `dist`.
4. Add Firebase Authorized Domains for your Pages URL.

### Required Cloudflare build variables

In Cloudflare Pages project settings, add these environment variables for the Production (and Preview) environment:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID` (recommended)
- `VITE_FIREBASE_MEASUREMENT_ID` (optional)
- `VITE_ADMIN_UIDS` (optional, app-specific roles bootstrap)

`npm run build` now fails if the required Firebase keys are missing, which prevents shipping a broken auth build.

## Tests

```bash
npx vitest run
```
