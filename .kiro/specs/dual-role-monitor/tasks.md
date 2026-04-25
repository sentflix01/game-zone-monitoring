# Implementation Plan: Dual-Role Monitor

## Overview

Implement the dual-role monitor system that allows a single person to hold both an Owner and Monitor role using the same email address but separate passwords. The implementation proceeds backend-first (Cloud Functions), then AuthContext, then frontend pages, then security rules, with property-based tests placed inline with the features they validate.

## Tasks

- [x] 1. Install bcryptjs dependency in Cloud Functions
  - Add `"bcryptjs": "^2.4.3"` to `functions/package.json` dependencies
  - Run `npm install` inside the `functions/` directory to update `package-lock.json`
  - Add `const bcrypt = require('bcryptjs');` import at the top of `functions/index.js`
  - _Requirements: 1.3_

- [x] 2. Update `createMonitor` Cloud Function
  - [x] 2.1 Detect existing Firebase Auth user and set `isExistingOwner`
    - Call `auth.getUserByEmail(email)` inside `createMonitor`
    - If the user exists, set `isExistingOwner = true` and use the existing `uid` as `monitorUid`
    - If the user does not exist, create a new Firebase Auth user with `email` + `password`; set `isExistingOwner = false`
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Hash monitor password and write Firestore documents
    - Hash the provided password with `bcrypt.hash(password, 10)` — never store plaintext
    - Write `owners/{ownerId}/users/{monitorUid}` with `{ email, displayName, isExistingOwner, monitorPasswordHash, createdAt }`
    - Write `userIndex/{monitorUid}` with `{ ownerId, email, role: "monitor", createdAt }` only when `isExistingOwner === false` (skip for existing owners to avoid `userIndex` collision)
    - Write or update `monitorCredentials/{encodeURIComponent(email)}` by appending `{ ownerId, monitorUid, monitorPasswordHash, displayName }` to the `entries` array
    - Return `{ success: true, uid: monitorUid, alreadyOwner: isExistingOwner }`
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.3 Write property test for existing-owner detection (P6)
    - **Property 6: Existing owner detection** — when `getUserByEmail` resolves, `isExistingOwner` is `true`; when it throws `auth/user-not-found`, `isExistingOwner` is `false`
    - Generate arbitrary valid email strings and stub `auth.getUserByEmail` to alternate between resolving and rejecting
    - Assert the returned `alreadyOwner` flag matches the stub outcome for every generated input
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 2.4 Write property test for password hash security (P3)
    - **Property 3: Password hash security** — no plaintext password appears in any Firestore document written by `createMonitor`
    - Generate arbitrary passwords (length ≥ 6) and capture all Firestore writes via a mock admin SDK
    - Assert that none of the written document fields equal the original plaintext password
    - **Validates: Requirements 1.3**

- [x] 3. Implement `monitorSignIn` Cloud Function
  - [x] 3.1 Look up `monitorCredentials` and verify password
    - Accept `{ email, password }` as callable arguments (no auth required)
    - Look up `monitorCredentials/{encodeURIComponent(email)}`; if the document does not exist, throw `unauthenticated` "Invalid credentials."
    - Iterate `entries` array; call `bcrypt.compare(password, entry.monitorPasswordHash)` for each entry
    - On first match, call `auth.createCustomToken(entry.monitorUid, { role: "monitor", ownerId: entry.ownerId })` and return `{ token }`
    - If no match found, throw `unauthenticated` "Invalid credentials."
    - _Requirements: 2.2, 2.3, 2.5, 2.6, 2.7_

  - [ ]* 3.2 Write property test for monitor login isolation (P2)
    - **Property 2: Monitor login isolation** — `monitorSignIn` always returns a token scoped to the `ownerId` of the matched entry, never to a different owner's `ownerId`
    - Generate arbitrary `entries` arrays with distinct `ownerId` values and matching passwords; call `monitorSignIn` with each password
    - Assert the custom token claims contain exactly the `ownerId` from the matched entry
    - **Validates: Requirements 2.3, 2.5**

- [x] 4. Checkpoint — Cloud Functions auth core complete
  - Ensure `createMonitor` and `monitorSignIn` unit tests pass
  - Verify bcrypt import resolves correctly in the functions runtime
  - Ask the user if any questions arise before proceeding.

- [x] 5. Implement `updateMonitorPassword` Cloud Function
  - [x] 5.1 Verify current password and update hash everywhere
    - Accept `{ currentPassword, newPassword }` (caller must be authenticated)
    - Resolve `monitorUid` from `context.auth.uid`; look up email from `owners/{ownerId}/users/{monitorUid}`
    - Look up `monitorCredentials/{encodeURIComponent(email)}`; find the entry matching `monitorUid`; verify `currentPassword` with `bcrypt.compare`
    - If verification fails, throw `unauthenticated`; if `newPassword` < 6 chars, throw `invalid-argument`
    - Hash `newPassword` with `bcrypt.hash(newPassword, 10)`
    - Update `monitorPasswordHash` in **all** matching entries in `monitorCredentials/{email}/entries` (multi-owner case)
    - Update `monitorPasswordHash` in `owners/{ownerId}/users/{monitorUid}`
    - Write Notification to `owners/{ownerId}/notifications/` with `{ type: "monitor_password_changed", monitorUid, displayName, timestamp, read: false }`
    - Return `{ success: true }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 5.2 Write property test for multi-owner password isolation (P4)
    - **Property 4: Multi-owner isolation** — updating the password hash for one owner's entry in `monitorCredentials` does not alter the `monitorPasswordHash` of any other owner's entry in the same `entries` array
    - Generate `entries` arrays with 2–5 owners; call `updateMonitorPassword` targeting one specific `ownerId`
    - Assert all other entries retain their original `monitorPasswordHash` values
    - **Validates: Requirements 4.7**

  - [ ]* 5.3 Write property test for notification delivery on password change (P5)
    - **Property 5: Notification delivery** — every successful `updateMonitorPassword` call writes exactly one Notification document per owner the monitor is registered under
    - Generate monitors registered under 1–5 owners; call `updateMonitorPassword` with a valid current password
    - Assert the number of Notification writes equals the number of owners in `entries`
    - **Validates: Requirements 4.3**

- [x] 6. Implement `updateMonitorEmail` Cloud Function
  - [x] 6.1 Verify password and perform atomic email migration
    - Accept `{ currentPassword, newEmail }` (caller must be authenticated)
    - Resolve `monitorUid` and `oldEmail` from context + Firestore
    - Verify `currentPassword` against stored hash; throw `unauthenticated` on failure
    - Check `monitorCredentials/{encodeURIComponent(newEmail)}` does not exist; throw `already-exists` if it does
    - Perform atomic Firestore batch write:
      - Create `monitorCredentials/{encodeURIComponent(newEmail)}` with the existing entries array (email fields updated)
      - Delete `monitorCredentials/{encodeURIComponent(oldEmail)}`
      - Update `email` in `owners/{ownerId}/users/{monitorUid}`
      - Update `email` in `userIndex/{monitorUid}`
    - Write a Notification to each owner's `notifications/` subcollection with `{ type: "monitor_email_changed", monitorUid, oldEmail, newEmail, displayName, timestamp, read: false }`
    - Return `{ success: true }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 6.2 Write property test for notification delivery on email change (P5 — email variant)
    - **Property 5: Notification delivery (email change)** — every successful `updateMonitorEmail` call writes one Notification per owner the monitor is registered under
    - Generate monitors registered under 1–5 owners; call `updateMonitorEmail` with a valid password and new email
    - Assert the number of Notification writes equals the number of owners in `entries`
    - **Validates: Requirements 5.3, 5.7**

- [x] 7. Update `deleteMonitor` Cloud Function
  - [x] 7.1 Remove `monitorCredentials` entry and conditionally delete Auth user
    - Read `isExistingOwner` and `email` from `owners/{ownerId}/users/{monitorUid}`
    - Remove the entry where `ownerId` matches from `monitorCredentials/{encodeURIComponent(email)}/entries`
    - If `entries` array is now empty, delete the entire `monitorCredentials` document
    - Delete `owners/{ownerId}/users/{monitorUid}`
    - Delete `userIndex/{monitorUid}` only when `isExistingOwner === false`
    - Delete the Firebase Auth user only when `isExistingOwner === false`
    - Return `{ success: true }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 7.2 Write property test for cleanup on removal (P7)
    - **Property 7: Cleanup on removal** — after `deleteMonitor`, the `monitorCredentials` entry for the deleted `ownerId` is absent; the document is deleted when the entry was the last one
    - Generate `entries` arrays of size 1–5; call `deleteMonitor` targeting one entry
    - Assert the targeted entry is absent from the resulting `entries`; assert the document is deleted when the pre-deletion size was 1
    - **Validates: Requirements 6.1, 6.2**

- [x] 8. Checkpoint — All Cloud Functions complete
  - Ensure all Cloud Function unit and property tests pass
  - Ask the user if any questions arise before proceeding.

- [x] 9. Update `AuthContext` for custom token claims
  - [x] 9.1 Check custom token claims before `userIndex` lookup in `resolveUser`
    - At the top of `resolveUser`, call `firebaseUser.getIdTokenResult()`
    - If `tokenResult.claims.role === 'monitor'` and `tokenResult.claims.ownerId` is present, set `role = 'monitor'` and `ownerId = tokenResult.claims.ownerId` and return early — skip the `userIndex` lookup
    - All other existing `resolveUser` logic remains unchanged
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 9.2 Write property test for owner login unaffected (P1)
    - **Property 1: Owner login unaffected** — when `getIdTokenResult()` returns claims without `role: "monitor"`, `resolveUser` always resolves to `role = "owner"` via the existing `userIndex` path
    - Generate arbitrary Firebase user objects whose token claims do not contain `role: "monitor"`; run `resolveUser` with a mocked `userIndex` returning no entry
    - Assert `role` is always `"owner"` and `ownerId` equals the user's own `uid`
    - **Validates: Requirements 3.2, 3.3**

- [ ] 10. Update Login page for dual-path authentication
  - [x] 10.1 Add monitor sign-in fallback in `handleEmail`
    - Import `signInWithCustomToken` from `firebase/auth` and `httpsCallable` from `firebase/functions` (if not already imported)
    - After `signInWithEmailAndPassword` throws with code `auth/wrong-password`, `auth/invalid-credential`, or `auth/user-not-found`, call the `monitorSignIn` Cloud Function with `{ email, password }`
    - On success, call `signInWithCustomToken(auth, result.data.token)` to complete authentication
    - On `monitorSignIn` failure, show `toast.error('Invalid email or password.')`
    - Keep the loading indicator active and submit button disabled throughout both attempts
    - All other sign-in paths (Google, registration, forgot-password) remain unchanged
    - _Requirements: 2.1, 2.4, 2.8, 2.9_

- [x] 11. Add `firestoreClient` notification helpers
  - [x] 11.1 Implement `listNotifications` and `markNotificationRead`
    - Add `listNotifications(ownerId)` to `src/api/firestoreClient.js`: query `owners/{ownerId}/notifications/` ordered by `createdAt` descending, return all documents
    - Add `markNotificationRead(ownerId, notificationId)` to `src/api/firestoreClient.js`: update `read: true` on `owners/{ownerId}/notifications/{notificationId}`
    - _Requirements: 7.4, 7.5_

- [x] 12. Update Monitors page
  - [x] 12.1 Show "Also an Owner" badge for dual-role monitors
    - In the monitor list, check `monitor.isExistingOwner === true` and render a visual badge (e.g., a yellow pill labelled "Also an Owner") on that list entry
    - _Requirements: 7.3_

  - [x] 12.2 Show dual-role warning banner after `createMonitor` returns `alreadyOwner: true`
    - After `createMonitor` resolves with `alreadyOwner: true`, display a persistent yellow warning banner explaining the dual-role setup (separate monitor password, owner account unaffected)
    - The banner should be dismissible and reset when the form is cleared
    - _Requirements: 7.1, 7.2_

  - [x] 12.3 Load and display unread notifications from owners' notifications subcollection
    - On mount (and after any monitor action), call `firestoreClient.listNotifications(ownerId)` and store results in component state
    - Render unread notifications in a panel or list, showing `type`, `displayName`, and `createdAt`
    - When an owner views a notification, call `firestoreClient.markNotificationRead(ownerId, notificationId)` and update local state to reflect `read: true`
    - _Requirements: 7.4, 7.5_

- [x] 13. Update Settings page with Monitor Account section
  - [x] 13.1 Add "Monitor Account" section visible only to monitors
    - Wrap the new section with `{role === 'monitor' && ( ... )}` so it is invisible to owners
    - _Requirements: 8.1, 8.2_

  - [x] 13.2 Implement change-monitor-password form
    - Render three fields: current password, new password, confirm new password
    - Validate that new password and confirm-password match client-side; show inline error if they do not — do not call the Cloud Function
    - On valid submission, call `updateMonitorPassword` Cloud Function; show success or error toast based on result
    - _Requirements: 8.3, 8.4, 8.6_

  - [x] 13.3 Implement change-monitor-email form
    - Render two fields: new email, current password
    - On submission, call `updateMonitorEmail` Cloud Function; show success or error toast based on result
    - _Requirements: 8.3, 8.5_

- [x] 14. Update Firestore security rules
  - [x] 14.1 Lock `monitorCredentials` to server-side only
    - Add rule: `match /monitorCredentials/{email} { allow read, write: if false; }` — Cloud Functions use the admin SDK and bypass client rules
    - _Requirements: 1.3, 2.2_

  - [x] 14.2 Allow owners to read and update their own notifications
    - Add rule: `match /owners/{ownerId}/notifications/{notificationId} { allow read, update: if request.auth != null && request.auth.uid == ownerId; allow write: if false; }`
    - _Requirements: 7.4, 7.5_

- [x] 15. Final checkpoint — build and tests
  - Run `npm run build` in the project root and confirm no compilation errors
  - Run `npx vitest --run` and confirm all tests pass
  - Ask the user if any questions arise before considering the feature complete.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests (P1–P7) are placed immediately after the implementation task they validate to catch regressions early
- All Cloud Functions use the Firebase Admin SDK (bypasses Firestore security rules); client-side code uses the regular Firebase SDK (subject to rules)
- The `monitorCredentials` document key uses `encodeURIComponent(email)` to produce a safe Firestore document ID
- For dual-role users (`isExistingOwner === true`), `userIndex` is intentionally not written by `createMonitor` to avoid colliding with the owner's existing identity; role resolution relies on Custom Token claims instead
- Checkpoints at tasks 4, 8, and 15 ensure incremental validation before moving to the next layer
