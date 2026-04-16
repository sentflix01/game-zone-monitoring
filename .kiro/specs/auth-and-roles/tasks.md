# Implementation Plan: auth-and-roles

## Overview

Replace the stub `AuthContext` with real Firebase Authentication (phone OTP + Google OAuth), add role-based access control via `ProtectedRoute`, `AdminRoute`, and `RoleGuard` components, and wire role-aware UI into all affected pages. All data continues to live in `storageAdapter`; Firebase handles identity only.

## Tasks

- [x] 1. Install dependencies and configure environment
  - Run `npm install firebase @codetrix-studio/capacitor-google-auth`
  - Run `npm install --save-dev fast-check`
  - Create `.env.example` with all required `VITE_FIREBASE_*` variables:
    `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
    `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_MEASUREMENT_ID`
  - _Requirements: 1.1, 2.1, 3.1, 9.1_

- [x] 2. Create `src/lib/firebase.js` — Firebase app and auth init
  - Initialize Firebase app from `VITE_FIREBASE_*` env vars
  - Export `auth` (Firebase Auth instance)
  - Throw a descriptive error at module load time if any required env var is missing
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 3. Replace `src/lib/AuthContext.jsx` with real Firebase Auth integration
  - [x] 3.1 Implement `AuthProvider` with Firebase `onAuthStateChanged` listener
    - Expose `{ user, role, isAuthenticated, isLoadingAuth, authError, logout, setRole }` on context
    - On first auth: assign `"user"` role by default; read existing role from `storageAdapter` key `gamezone_user_role` if present
    - On logout: call `signOut(auth)`, clear `gamezone_user_role` from storage, set `user`/`role` to `null`
    - On app start offline with cached role: restore session from cached token without network call
    - _Requirements: 1.4, 1.5, 4.1, 4.3, 5.2, 5.3, 5.4, 9.1, 9.2_

  - [x] 3.2 Write property test — Property 3: Logout produces clean unauthenticated state
    - **Property 3: Logout produces clean unauthenticated state**
    - `fc.record({ uid: fc.string(), role: fc.constantFrom('admin', 'user') })` → call `logout()` → assert `user === null`, `role === null`, `isAuthenticated === false`, storage key cleared
    - **Validates: Requirements 4.1, 4.3**

  - [x] 3.3 Write property test — Property 4: Role values are always valid
    - **Property 4: Role values are always valid**
    - `fc.oneof(fc.constant('admin'), fc.constant('user'))` → `setRole` → read `storageAdapter` → assert value is exactly `"admin"` or `"user"`
    - **Validates: Requirements 5.1**

  - [x] 3.4 Write property test — Property 5: New users receive the `user` role by default
    - **Property 5: New users receive the `user` role by default**
    - `fc.string()` uid with no pre-existing storage key → simulate first-time auth → assert `role === 'user'`
    - **Validates: Requirements 5.2**

  - [x] 3.5 Write property test — Property 6: Role persistence round-trip
    - **Property 6: Role persistence round-trip**
    - `fc.oneof(fc.constant('admin'), fc.constant('user'))` → `setRole` → read storage and context → assert both match the assigned value
    - **Validates: Requirements 5.3, 5.6**

- [x] 4. Create `src/components/ProtectedRoute.jsx`
  - While `isLoadingAuth === true`: render a full-screen spinner
  - While `isAuthenticated === false`: `<Navigate to="/login" replace />`
  - Otherwise: render `<Outlet />` (or `children`)
  - _Requirements: 1.1, 1.4_

  - [x] 4.1 Write property test — Property 1: Unauthenticated users are always redirected to Login
    - **Property 1: Unauthenticated users are always redirected to Login**
    - `fc.string()` route paths → render `ProtectedRoute` with unauthenticated context → assert redirect to `/login`
    - **Validates: Requirements 1.1**

- [x] 5. Create `src/components/AdminRoute.jsx`
  - Wraps `ProtectedRoute`; if `role !== 'admin'`: redirect to `/` and fire `toast.error(t('auth.error.accessDenied'))`
  - Otherwise: render children / outlet
  - _Requirements: 6.1, 6.2_

  - [x] 5.1 Write property test — Property 7: Admin-only routes redirect regular users
    - **Property 7: Admin-only routes redirect regular users**
    - `fc.constantFrom('/analytics', '/expenses')` + `fc.oneof(fc.constant('admin'), fc.constant('user'))` → render `AdminRoute` → assert redirect + toast for `user`, content rendered for `admin`
    - **Validates: Requirements 6.1, 6.2**

- [x] 6. Create `src/components/RoleGuard.jsx`
  - Props: `role` (required), `fallback` (default `null`)
  - Reads `role` from `useAuth()`; renders `children` when roles match, `fallback` otherwise
  - _Requirements: 6.3, 6.4, 6.5, 6.6_

  - [x] 6.1 Write property test — Property 8: Admin-only UI elements hidden from regular users
    - **Property 8: Admin-only UI elements hidden from regular users**
    - `fc.oneof(fc.constant('admin'), fc.constant('user'))` → render component tree with `RoleGuard role="admin"` elements → assert elements absent for `user`, present for `admin`
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6**

- [x] 7. Create `src/pages/Login.jsx` — phone OTP + Google OAuth UI
  - Render phone number input + "Send OTP" button (step 1) and OTP input + "Verify" button (step 2)
  - Render invisible reCAPTCHA container (`id="recaptcha-container"`) required by Firebase phone auth
  - Render Google sign-in button; on native (Capacitor) use `@codetrix-studio/capacitor-google-auth`; on web use `signInWithPopup`
  - On success: navigate to `/`
  - On failure: display i18n error message via `toast.error`
  - If `navigator.onLine === false` and no cached session: disable sign-in buttons, show `auth.offline.message`
  - If already authenticated: `<Navigate to="/" replace />`
  - All labels, placeholders, and errors use `t()` from i18n context
  - _Requirements: 1.2, 1.3, 2.1–2.6, 3.1–3.5, 9.3, 10.1_

  - [x] 7.1 Write property test — Property 2: Authenticated users are redirected away from Login
    - **Property 2: Authenticated users are redirected away from Login**
    - `fc.record({ uid: fc.string(), role: fc.constantFrom('admin', 'user') })` → render `Login` with authenticated context → assert redirect to `/`
    - **Validates: Requirements 1.2**

- [x] 8. Update `src/App.jsx` — add `/login` route and wrap routes with auth guards
  - Add `import Login from './pages/Login'`
  - Add `<Route path="/login" element={<Login />} />` outside `<Layout />`
  - Wrap the `<Route element={<Layout />}>` block with `<ProtectedRoute>`
  - Wrap `/analytics` and `/expenses` routes with `<AdminRoute>`
  - _Requirements: 1.1, 1.2, 6.1, 6.2_

- [x] 9. Update `src/components/Layout.jsx` — role-filtered nav and logout button
  - Add `adminOnly` flag to each entry in `navDefs` per the design (`expenses` and `analytics` are `adminOnly: true`)
  - Filter `navDefs` before rendering: `role === 'admin' ? navDefs : navDefs.filter(n => !n.adminOnly)`
  - Add a logout button in the header (calls `logout()` from `useAuth()`) with label `t('auth.logout')`
  - _Requirements: 4.2, 8.1, 8.2_

  - [x] 9.1 Write property test — Property 10: Navigation items rendered match the user's role
    - **Property 10: Navigation items rendered match the user's role**
    - `fc.oneof(fc.constant('admin'), fc.constant('user'))` → render `Layout` → assert admin sees 8 nav items, user sees 6 (no Expenses, no Analytics)
    - **Validates: Requirements 8.1, 8.2**

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update `src/pages/Dashboard.jsx` — hide financial content from regular users
  - Import `RoleGuard` and `useAuth`
  - Wrap the "Today's Earnings" stat card in `<RoleGuard role="admin">`
  - Wrap both P&L cards (`dashboard.pnl.today` and `dashboard.pnl.thisMonth`) in `<RoleGuard role="admin">`
  - Wrap the "Manage expenses →" and "Full analytics →" links in `<RoleGuard role="admin">`
  - Leave Available, In Use, and Active Sessions stat cards unwrapped
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 11.1 Write property test — Property 9: Dashboard financial content visibility matches role
    - **Property 9: Dashboard financial content visibility matches role**
    - `fc.oneof(fc.constant('admin'), fc.constant('user'))` → render `Dashboard` → assert P&L cards and earnings stat absent for `user`, all present for `admin`; Available/In Use/Active Sessions always present
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [x] 12. Update `src/pages/Consoles.jsx` — wrap admin-only actions with RoleGuard
  - Import `RoleGuard`
  - Wrap the "Add Console" `<Button>` in `<RoleGuard role="admin">`
  - Wrap the Edit (`<Button onClick={() => openEdit(c)}>`) and Delete (`<Button onClick={() => remove(c.id)}>`) buttons in `<RoleGuard role="admin">`
  - _Requirements: 6.3, 6.4_

- [x] 13. Update `src/pages/Players.jsx` — wrap admin-only actions with RoleGuard
  - Import `RoleGuard`
  - Wrap any "Add Player" and "Delete Player" action buttons in `<RoleGuard role="admin">`
  - _Requirements: 6.6_

- [x] 14. Update `src/pages/Settings.jsx` — pricing form guard and role promotion UI
  - Import `RoleGuard` and `useAuth`
  - Wrap the entire pricing form `<div data-tour="pricing-form">` in `<RoleGuard role="admin">`
  - Add a role promotion section (admin only, wrapped in `<RoleGuard role="admin">`):
    - Input for target user UID or identifier
    - "Promote to Admin" button that calls `setRole(uid, 'admin')`
    - Display current role with label `t('auth.settings.currentRole')`
  - _Requirements: 5.5, 6.5_

- [x] 15. Add auth i18n keys to `src/i18n/locales/en.js` and `src/i18n/locales/am.js`
  - Add all keys listed in the design under "Auth i18n Keys":
    `auth.login.title`, `auth.login.subtitle`, `auth.login.phoneLabel`, `auth.login.phonePlaceholder`,
    `auth.login.sendOtp`, `auth.login.otpLabel`, `auth.login.otpPlaceholder`, `auth.login.verifyOtp`,
    `auth.login.googleButton`, `auth.login.orDivider`, `auth.login.backToPhone`, `auth.login.resendOtp`,
    `auth.error.invalidPhone`, `auth.error.invalidOtp`, `auth.error.otpExpired`,
    `auth.error.googleCancelled`, `auth.error.googleFailed`, `auth.error.networkError`,
    `auth.error.accessDenied`, `auth.offline.message`, `auth.logout`,
    `auth.role.admin`, `auth.role.user`,
    `auth.settings.promoteTitle`, `auth.settings.promoteLabel`, `auth.settings.promoteButton`, `auth.settings.currentRole`
  - English values in `en.js`; Amharic translations in `am.js`
  - _Requirements: 10.1, 10.2_

  - [x] 15.1 Write property test — Property 11: Auth translation keys present in all locales
    - **Property 11: Auth translation keys present in all locales**
    - `fc.constantFrom(...authKeys)` → check `en[key]` and `am[key]` both defined and non-empty
    - **Validates: Requirements 10.2**

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with Vitest; each must run ≥ 100 iterations and include the comment tag `// Feature: auth-and-roles, Property N: <property_text>`
- Unit tests (Login renders, OTP flow, Google OAuth flow, offline state, language switch) should be co-located with their respective component tests
- `RoleGuard` renders `null` by default when role doesn't match — use the `fallback` prop for explicit messaging
