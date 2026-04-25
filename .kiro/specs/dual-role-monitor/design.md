# Design Document: Dual-Role Monitor System

## Overview

This document describes the technical design for the dual-role monitor feature, which allows a single person to be both an **Owner** (their own game zone) and a **Monitor** (staff under another owner's zone) using the same email address but two separate passwords.

The design builds on the existing Firebase Auth + Firestore architecture. The owner password path is unchanged. The monitor password path is a new custom authentication flow implemented via Firebase Cloud Functions.

---

## Architecture

### Authentication Paths

```
User enters email + password
         │
         ▼
Try Firebase signInWithEmailAndPassword
         │
    ┌────┴────┐
  success   auth/wrong-password | auth/invalid-credential | auth/user-not-found
    │              │
    ▼              ▼
Normal auth    Call monitorSignIn Cloud Function
(owner path)   with { email, password }
                    │
               ┌────┴────┐
             success   failure
               │          │
               ▼          ▼
       signInWithCustomToken   Show "Invalid credentials" error
```

The key insight: the Login page tries Firebase Auth first. Only on a password-related failure does it fall back to the monitor sign-in path. This means the existing owner login flow is completely unaffected.

### Password Storage

Monitor passwords are **never stored in Firebase Auth**. They are stored as bcrypt hashes in Firestore, verified server-side by the `monitorSignIn` Cloud Function. On success, the function issues a Firebase Custom Token, which the client uses to call `signInWithCustomToken`. From that point on, the session is a normal Firebase Auth session.

### Role Resolution

The existing `AuthContext` already handles role resolution via `userIndex/{uid}`. When a monitor signs in via Custom Token, their `uid` is the `monitorUid` written by `createMonitor`. The `userIndex/{monitorUid}` document contains `ownerId`, so `AuthContext.getMonitorOwner()` returns the correct owner — no changes needed to `AuthContext`.

---

## Data Model

### Firestore Collections

```
owners/{ownerId}/
  users/{monitorUid}/
    email: string
    displayName: string
    isExistingOwner: boolean          ← true if email already had a Firebase Auth account
    monitorPasswordHash: string       ← bcrypt hash of the monitor password
    createdAt: timestamp

userIndex/{monitorUid}/
  ownerId: string
  email: string
  role: "monitor"
  createdAt: timestamp

monitorCredentials/{encodedEmail}/   ← keyed by encodeURIComponent(email)
  entries: Array<{
    ownerId: string
    monitorUid: string
    monitorPasswordHash: string
    displayName: string
  }>

owners/{ownerId}/notifications/{notificationId}/
  type: "monitor_password_changed" | "monitor_email_changed"
  message: string
  monitorEmail: string
  monitorUid: string
  displayName: string
  createdAt: timestamp
  read: boolean
```

### Key Design Decisions

**`monitorCredentials` keyed by encoded email**: Firestore document IDs cannot contain `/` or other special characters. Using `encodeURIComponent(email)` produces a safe, reversible key. The `entries` array supports multi-owner scenarios — one person can be a monitor under multiple owners, each with the same or different monitor password.

**`isExistingOwner` flag**: Stored on the monitor document so `deleteMonitor` knows whether to delete the Firebase Auth user. Existing owners must not have their Auth account deleted when removed as a monitor.

**bcrypt in Cloud Functions**: The `bcryptjs` npm package is used in Cloud Functions (Node 18 runtime). It is not used client-side. The cost factor is 10 (bcrypt default), which is appropriate for server-side verification.

---

## Cloud Functions

### 1. `createMonitor` (updated)

**Trigger**: `functions.https.onCall`  
**Auth required**: Yes (caller must be authenticated owner)

**Logic**:
1. Validate inputs: `email`, `password` (≥6 chars), `displayName`.
2. Call `auth.getUserByEmail(email)`:
   - **Exists** → set `isExistingOwner = true`, use existing `uid` as `monitorUid`.
   - **Does not exist** → create new Firebase Auth user with `email` + `password`; set `isExistingOwner = false`.
3. Hash `password` with `bcrypt.hash(password, 10)`.
4. Write `owners/{ownerId}/users/{monitorUid}` with `{ email, displayName, isExistingOwner, monitorPasswordHash, createdAt }`.
5. Write `userIndex/{monitorUid}` with `{ ownerId, email, role: "monitor", createdAt }` (only if not already present — existing owners already have a `userIndex` entry as owner; skip or use a separate field).
6. Write/update `monitorCredentials/{encodeURIComponent(email)}` by appending `{ ownerId, monitorUid, monitorPasswordHash, displayName }` to `entries` array.
7. Return `{ success: true, uid: monitorUid, alreadyOwner: isExistingOwner }`.

**Note on `userIndex` for existing owners**: An existing owner's `userIndex` entry does not exist (owners are identified by their own `uid` directly). The `createMonitor` function writes a `userIndex/{monitorUid}` entry. For a dual-role user, `monitorUid === ownerUid`, so the `userIndex` entry would override the owner's identity. To avoid this, the function must check: if `isExistingOwner === true`, do **not** write to `userIndex` (the owner's `AuthContext` resolution already works correctly via the absence of a `userIndex` entry). The monitor sign-in path uses the Custom Token with the `monitorUid` claim, and `AuthContext` will find the `userIndex` entry written for that specific monitor session.

**Revised approach for dual-role `userIndex`**: For `isExistingOwner = true`, write `userIndex/{monitorUid}` only if `monitorUid !== ownerId`. Since for an existing owner `monitorUid === ownerUid`, skip the `userIndex` write. Instead, the Custom Token issued by `monitorSignIn` will carry a custom claim `{ monitorOwnerId: ownerId }` that `AuthContext` can read directly from the token claims.

**Simpler approach (chosen)**: For existing owners acting as monitors, `monitorSignIn` issues a Custom Token with additional claims: `{ role: "monitor", ownerId: <the-owner-they-monitor-for> }`. `AuthContext` reads these claims from `user.getIdTokenResult()` to resolve the role. This avoids the `userIndex` collision entirely.

### 2. `monitorSignIn` (new)

**Trigger**: `functions.https.onCall`  
**Auth required**: No (this is the authentication step itself)

**Logic**:
1. Validate inputs: `email`, `password`.
2. Look up `monitorCredentials/{encodeURIComponent(email)}`.
3. If document does not exist → throw `unauthenticated` "Invalid credentials."
4. Iterate `entries` array; for each entry, call `bcrypt.compare(password, entry.monitorPasswordHash)`.
5. First match found → call `auth.createCustomToken(entry.monitorUid, { role: "monitor", ownerId: entry.ownerId })`.
6. Return `{ token }`.
7. If no match → throw `unauthenticated` "Invalid credentials."

**Security**: The function does not reveal whether the email exists or not — both "email not found" and "wrong password" return the same error message.

### 3. `updateMonitorPassword` (new)

**Trigger**: `functions.https.onCall`  
**Auth required**: Yes (caller must be authenticated monitor)

**Logic**:
1. Validate inputs: `currentPassword`, `newPassword` (≥6 chars).
2. Resolve `monitorUid` from `context.auth.uid`.
3. Look up `monitorCredentials/{encodeURIComponent(email)}` (email from `context.auth.token.email` or from `owners/{ownerId}/users/{monitorUid}`).
4. Find the entry matching `monitorUid`; verify `currentPassword` against `monitorPasswordHash`.
5. If verification fails → throw `unauthenticated`.
6. Hash `newPassword` with `bcrypt.hash(newPassword, 10)`.
7. Update `monitorPasswordHash` in all matching entries in `monitorCredentials/{email}/entries`.
8. Update `monitorPasswordHash` in `owners/{ownerId}/users/{monitorUid}`.
9. Write Notification to `owners/{ownerId}/notifications/`.
10. Return `{ success: true }`.

### 4. `updateMonitorEmail` (new)

**Trigger**: `functions.https.onCall`  
**Auth required**: Yes (caller must be authenticated monitor)

**Logic**:
1. Validate inputs: `currentPassword`, `newEmail`.
2. Resolve `monitorUid` and `oldEmail` from context + Firestore.
3. Verify `currentPassword` against stored hash.
4. Check `monitorCredentials/{encodeURIComponent(newEmail)}` does not exist → if it does, throw `already-exists`.
5. Atomic batch write:
   - Create `monitorCredentials/{encodeURIComponent(newEmail)}` with the existing entries (email updated).
   - Delete `monitorCredentials/{encodeURIComponent(oldEmail)}`.
   - Update `email` in `owners/{ownerId}/users/{monitorUid}`.
   - Update `email` in `userIndex/{monitorUid}`.
6. Write Notification to each owner's `notifications/` subcollection.
7. Return `{ success: true }`.

### 5. `deleteMonitor` (updated)

**Trigger**: `functions.https.onCall`  
**Auth required**: Yes (caller must be authenticated owner)

**Logic**:
1. Validate `monitorUid`.
2. Verify caller owns the monitor record (`owners/{ownerId}/users/{monitorUid}` must exist).
3. Read `isExistingOwner` and `email` from the monitor document.
4. Remove the matching entry from `monitorCredentials/{encodeURIComponent(email)}/entries`.
5. If `entries` array is now empty → delete the `monitorCredentials` document.
6. Delete `owners/{ownerId}/users/{monitorUid}`.
7. Delete `userIndex/{monitorUid}` (only if `isExistingOwner === false`).
8. If `isExistingOwner === false` → delete Firebase Auth user.
9. Return `{ success: true }`.

---

## Frontend Changes

### Login Page (`src/pages/Login.jsx`)

The `handleEmail` function is updated to implement the dual-path flow:

```javascript
async function handleEmail(e) {
  e.preventDefault();
  if (!email.trim() || !password) return;
  setLoadingBtn('email');
  try {
    // Path 1: Try owner sign-in via Firebase Auth
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (err) {
    const isPasswordError = [
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/user-not-found',
    ].includes(err.code);

    if (isPasswordError) {
      // Path 2: Try monitor sign-in via Cloud Function
      try {
        const monitorSignIn = httpsCallable(functions, 'monitorSignIn');
        const result = await monitorSignIn({ email: email.trim(), password });
        await signInWithCustomToken(auth, result.data.token);
      } catch (monitorErr) {
        toast.error('Invalid email or password.');
        setLoadingBtn(null);
      }
    } else {
      toast.error(errMsg(err.code) || 'Sign in failed.');
      setLoadingBtn(null);
    }
  }
}
```

**No changes** to the Google sign-in path, registration path, or forgot-password path.

### AuthContext (`src/lib/AuthContext.jsx`)

The existing `resolveUser` logic already handles monitors correctly via `userIndex`. For dual-role users (existing owners acting as monitors), the Custom Token carries `{ role: "monitor", ownerId }` claims. `AuthContext` must read these claims:

```javascript
async function resolveUser(firebaseUser) {
  // Check custom token claims first (for dual-role monitor sign-in)
  const tokenResult = await firebaseUser.getIdTokenResult();
  if (tokenResult.claims.role === 'monitor' && tokenResult.claims.ownerId) {
    writeAuthCache(firebaseUser.uid, 'monitor', tokenResult.claims.ownerId);
    setUser(firebaseUser);
    setRoleState('monitor');
    setOwnerId(tokenResult.claims.ownerId);
    setIsAuthenticated(true);
    setIsLoadingAuth(false);
    return;
  }

  // Existing logic: check userIndex for regular monitors
  const monitorOwnerId = await firestoreClient.getMonitorOwner(firebaseUser.uid);
  // ... rest of existing logic unchanged
}
```

### Monitors Page (`src/pages/Monitors.jsx`)

**New features**:
1. **Dual-role warning banner**: After `createMonitor` returns `{ alreadyOwner: true }`, show a yellow warning banner.
2. **"Also an Owner" badge**: In the monitor list, show a badge for monitors with `isExistingOwner: true`.
3. **Notifications panel**: Load and display unread notifications from `owners/{ownerId}/notifications/`. Mark as read on view.

**Email pre-check**: Before form submission, optionally call a lightweight check (or rely on the `createMonitor` response) to show the warning. The warning is shown after `createMonitor` returns `alreadyOwner: true` — the form resets and a persistent banner is shown until dismissed.

### Settings Page (`src/pages/Settings.jsx`)

**New "Monitor Account" section** — visible only when `role === 'monitor'`:

```jsx
{role === 'monitor' && (
  <div className="bg-game-surface border border-game-border rounded-xl p-6 space-y-4">
    <h3 className="text-white font-semibold">Monitor Account</h3>
    {/* Change monitor password form */}
    {/* Change monitor email form */}
  </div>
)}
```

Both forms require the current monitor password for verification. They call `updateMonitorPassword` and `updateMonitorEmail` Cloud Functions respectively.

---

## Security Considerations

1. **bcrypt cost factor 10**: Appropriate for server-side verification. Adds ~100ms latency per verification, which is acceptable for a login flow.
2. **No plaintext passwords**: Monitor passwords are hashed immediately in the Cloud Function before any Firestore write.
3. **Consistent error messages**: `monitorSignIn` returns the same error for "email not found" and "wrong password" to prevent email enumeration.
4. **Caller verification**: All mutating Cloud Functions verify `context.auth` and check that the caller owns the relevant records.
5. **Firestore rules**: The `monitorCredentials` collection must only be readable/writable by Cloud Functions (server-side admin SDK), not by clients directly.

---

## Firestore Security Rules

The following rules additions are needed:

```
// monitorCredentials — server-side only (Cloud Functions use admin SDK, bypass rules)
match /monitorCredentials/{email} {
  allow read, write: if false; // Only accessible via Cloud Functions
}

// notifications — owner can read/update their own notifications
match /owners/{ownerId}/notifications/{notificationId} {
  allow read, update: if request.auth != null && request.auth.uid == ownerId;
  allow write: if false; // Only Cloud Functions write notifications
}
```

---

## Dependencies

### Cloud Functions (`functions/package.json`)

Add `bcryptjs`:
```json
"bcryptjs": "^2.4.3"
```

`bcryptjs` is a pure-JavaScript bcrypt implementation with no native bindings, making it reliable on Cloud Functions Node 18.

### Frontend

No new npm dependencies. The `httpsCallable` and `signInWithCustomToken` APIs are already available from the existing `firebase` package.

---

## Implementation Phases

| Phase | What | Files |
|---|---|---|
| 1 | Update `createMonitor` Cloud Function | `functions/index.js` |
| 2 | New `monitorSignIn` Cloud Function | `functions/index.js` |
| 3 | Update Login page — dual-path auth | `src/pages/Login.jsx` |
| 4 | Update Monitors page — warning, badges | `src/pages/Monitors.jsx` |
| 5 | New `updateMonitorPassword` + `updateMonitorEmail` Cloud Functions | `functions/index.js` |
| 6 | Add Monitor Settings section | `src/pages/Settings.jsx` |
| 7 | Add notifications display to Monitors page | `src/pages/Monitors.jsx` |
| 8 | Update `deleteMonitor` cleanup | `functions/index.js` |
| 9 | Update AuthContext for custom token claims | `src/lib/AuthContext.jsx` |
| 10 | Update Firestore security rules | `firestore.rules` |
| 11 | Add `firestoreClient` helpers for notifications | `src/api/firestoreClient.js` |
