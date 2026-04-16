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

## Roles

- `admin` — full access (financial data, expenses, analytics, console/player management)
- `user` — operational access (start/end sessions, view consoles and players)

Admin UIDs are set via `VITE_ADMIN_UIDS` in `.env`. The first user whose UID matches gets admin role automatically on first login.

## Build

```bash
npm run build          # web
npx cap sync           # sync to Android/iOS
npx cap open android   # open in Android Studio
npx cap open ios       # open in Xcode
```

## Tests

```bash
npx vitest run
```
