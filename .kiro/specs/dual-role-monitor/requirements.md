# Requirements Document

## Introduction

The dual-role-monitor feature allows a single person to hold two simultaneous roles in the system: **Owner** (managing their own game zone) and **Monitor** (staff member under one or more other owners' zones), using the same email address but separate passwords. The owner password authenticates via Firebase Auth as today; the monitor password authenticates via a custom Cloud Function flow that issues a Firebase Custom Token. A single Login page handles both paths transparently.

## Glossary

- **Owner**: A user who has their own game zone and full administrative access to it. Authenticated via Firebase Auth (email/password or Google).
- **Monitor**: A staff member scoped to an owner's zone. Authenticated via the custom `monitorSignIn` Cloud Function.
- **Dual-Role User**: A person whose email is registered as both an Owner in Firebase Auth and as a Monitor under one or more other owners.
- **Monitor Password**: A separate password (distinct from the owner password) used exclusively for monitor sign-in. Stored as a bcrypt hash in Firestore; never stored in Firebase Auth.
- **Owner Password**: The existing Firebase Auth password used by an owner to access their own zone.
- **Custom Token**: A Firebase Custom Token issued by the `monitorSignIn` Cloud Function upon successful monitor password verification, used to sign the user into Firebase Auth client-side.
- **monitorCredentials**: A Firestore top-level collection keyed by email, holding an array of `{ ownerId, monitorUid, monitorPasswordHash, displayName }` entries — one per owner who has added this person as a monitor.
- **Login_Page**: The single React page (`src/pages/Login.jsx`) that handles all authentication paths.
- **AuthContext**: The React context (`src/lib/AuthContext.jsx`) that resolves the authenticated user's role and `ownerId` after sign-in.
- **createMonitor_Function**: The `createMonitor` Cloud Function (updated) that detects existing owners, hashes the monitor password, and writes to `monitorCredentials`.
- **monitorSignIn_Function**: The new `monitorSignIn` Cloud Function that verifies a monitor password hash and issues a Custom Token.
- **updateMonitorPassword_Function**: The new `updateMonitorPassword` Cloud Function that allows a monitor to change their own monitor password.
- **updateMonitorEmail_Function**: The new `updateMonitorEmail` Cloud Function that allows a monitor to change their own email, updating all relevant Firestore documents.
- **deleteMonitor_Function**: The `deleteMonitor` Cloud Function (updated) that cleans up `monitorCredentials` entries on monitor removal.
- **Notification**: A Firestore document written to `owners/{ownerId}/notifications/` to inform an owner of a monitor's self-service change.
- **bcrypt**: The password hashing algorithm used to hash and verify monitor passwords server-side.

---

## Requirements

### Requirement 1: Dual-Role Account Creation

**User Story:** As an owner, I want to add a monitor using an email that already belongs to another owner, so that a colleague can staff my zone without needing a separate email account.

#### Acceptance Criteria

1. WHEN an owner submits the "Add Monitor" form with an email that already exists in Firebase Auth, THE createMonitor_Function SHALL detect the existing account, set `isExistingOwner: true` on the monitor document, and skip creating a new Firebase Auth user.
2. WHEN an owner submits the "Add Monitor" form with an email that does not exist in Firebase Auth, THE createMonitor_Function SHALL create a new Firebase Auth user with the provided email and password as the owner password, then proceed with monitor setup.
3. THE createMonitor_Function SHALL hash the provided monitor password using bcrypt before storing it, and SHALL NOT store the plaintext password anywhere.
4. THE createMonitor_Function SHALL write a document to `owners/{ownerId}/users/{monitorUid}/` containing `email`, `displayName`, `isExistingOwner`, `monitorPasswordHash`, and `createdAt`.
5. THE createMonitor_Function SHALL write or update a document in `monitorCredentials/{email}/` by appending an entry `{ ownerId, monitorUid, monitorPasswordHash, displayName }` to the `entries` array.
6. THE createMonitor_Function SHALL write a document to `userIndex/{monitorUid}/` containing `ownerId` and `email` if the entry does not already exist.
7. IF the provided monitor password is fewer than 6 characters, THEN THE createMonitor_Function SHALL return an `invalid-argument` error without creating any documents.
8. IF the caller is not authenticated, THEN THE createMonitor_Function SHALL return an `unauthenticated` error.

---

### Requirement 2: Monitor Sign-In

**User Story:** As a dual-role user, I want to sign in with my monitor password and land on the correct owner's zone as a monitor, so that I can perform my staff duties without affecting my own owner account.

#### Acceptance Criteria

1. WHEN a user submits the login form and Firebase Auth returns an `auth/wrong-password` or `auth/invalid-credential` error, THE Login_Page SHALL call the `monitorSignIn` Cloud Function with the submitted email and password.
2. WHEN the `monitorSignIn` Cloud Function receives a valid email and password, THE monitorSignIn_Function SHALL look up the `monitorCredentials/{email}` document and compare the password against each entry's `monitorPasswordHash` using bcrypt.
3. WHEN a bcrypt comparison succeeds for an entry, THE monitorSignIn_Function SHALL issue a Firebase Custom Token for the corresponding `monitorUid` and return it to the client.
4. WHEN the Login_Page receives a Custom Token from `monitorSignIn`, THE Login_Page SHALL call `signInWithCustomToken` to complete authentication.
5. WHEN multiple entries exist for the same email in `monitorCredentials`, THE monitorSignIn_Function SHALL attempt verification against all entries and sign into the first matching one.
6. IF no bcrypt comparison succeeds for any entry, THEN THE monitorSignIn_Function SHALL return an `unauthenticated` error with the message "Invalid credentials."
7. IF the `monitorCredentials/{email}` document does not exist, THEN THE monitorSignIn_Function SHALL return an `unauthenticated` error with the message "Invalid credentials."
8. WHILE a monitor sign-in attempt is in progress, THE Login_Page SHALL display a loading indicator and disable the submit button.
9. THE existing owner sign-in flow via Firebase Auth SHALL remain unchanged; THE Login_Page SHALL only call `monitorSignIn` after a Firebase Auth password failure.

---

### Requirement 3: AuthContext Role Resolution for Dual-Role Users

**User Story:** As a dual-role user who signed in with a monitor password, I want the app to correctly identify me as a monitor scoped to the right owner's zone, so that I see only that owner's data.

#### Acceptance Criteria

1. WHEN a user signs in via Custom Token and `userIndex/{uid}` contains an `ownerId`, THE AuthContext SHALL set `role` to `"monitor"` and `ownerId` to the value from `userIndex`.
2. WHEN a user signs in via Firebase Auth (owner password) and `userIndex/{uid}` does not contain an entry, THE AuthContext SHALL set `role` to `"owner"` and `ownerId` to the user's own `uid`.
3. THE AuthContext SHALL NOT change its existing logic for resolving owner vs. monitor roles; the Custom Token sign-in path is handled transparently because `userIndex` is populated by `createMonitor_Function`.

---

### Requirement 4: Monitor Self-Service — Change Password

**User Story:** As a monitor, I want to change my own monitor password from the Settings page, so that I can maintain my own account security without involving the owner.

#### Acceptance Criteria

1. WHEN a monitor submits a new monitor password from the Settings page, THE updateMonitorPassword_Function SHALL verify the current monitor password against the stored bcrypt hash before accepting the change.
2. WHEN the current password verification succeeds, THE updateMonitorPassword_Function SHALL hash the new password with bcrypt and update `monitorPasswordHash` in both `owners/{ownerId}/users/{monitorUid}/` and the corresponding entry in `monitorCredentials/{email}/entries`.
3. WHEN the password update succeeds, THE updateMonitorPassword_Function SHALL write a Notification document to `owners/{ownerId}/notifications/` containing `type: "monitor_password_changed"`, `monitorUid`, `displayName`, and `timestamp`.
4. IF the new monitor password is fewer than 6 characters, THEN THE updateMonitorPassword_Function SHALL return an `invalid-argument` error without modifying any documents.
5. IF the current password verification fails, THEN THE updateMonitorPassword_Function SHALL return an `unauthenticated` error without modifying any documents.
6. IF the caller is not authenticated, THEN THE updateMonitorPassword_Function SHALL return an `unauthenticated` error.
7. WHERE a monitor is registered under multiple owners, THE updateMonitorPassword_Function SHALL update the `monitorPasswordHash` in all matching entries in `monitorCredentials/{email}/entries`.

---

### Requirement 5: Monitor Self-Service — Change Email

**User Story:** As a monitor, I want to change my own email address from the Settings page, so that I can keep my contact information current.

#### Acceptance Criteria

1. WHEN a monitor submits a new email address from the Settings page, THE updateMonitorEmail_Function SHALL verify the monitor's current password before accepting the change.
2. WHEN the password verification succeeds, THE updateMonitorEmail_Function SHALL update the `email` field in `owners/{ownerId}/users/{monitorUid}/`, `userIndex/{monitorUid}/`, and create a new `monitorCredentials/{newEmail}/` document with the existing entries array, then delete `monitorCredentials/{oldEmail}/`.
3. WHEN the email update succeeds, THE updateMonitorEmail_Function SHALL write a Notification document to `owners/{ownerId}/notifications/` containing `type: "monitor_email_changed"`, `monitorUid`, `oldEmail`, `newEmail`, `displayName`, and `timestamp`.
4. IF the new email is already in use in `monitorCredentials`, THEN THE updateMonitorEmail_Function SHALL return an `already-exists` error without modifying any documents.
5. IF the password verification fails, THEN THE updateMonitorEmail_Function SHALL return an `unauthenticated` error without modifying any documents.
6. IF the caller is not authenticated, THEN THE updateMonitorEmail_Function SHALL return an `unauthenticated` error.
7. WHERE a monitor is registered under multiple owners, THE updateMonitorEmail_Function SHALL write a Notification to each owner's `notifications/` subcollection.

---

### Requirement 6: Monitor Deletion Cleanup

**User Story:** As an owner, I want removing a monitor to fully clean up all associated credentials, so that the removed monitor can no longer sign in to my zone.

#### Acceptance Criteria

1. WHEN an owner deletes a monitor, THE deleteMonitor_Function SHALL remove the corresponding entry from `monitorCredentials/{email}/entries` where `ownerId` matches.
2. WHEN the deleted entry was the last entry in `monitorCredentials/{email}/entries`, THE deleteMonitor_Function SHALL delete the entire `monitorCredentials/{email}/` document.
3. WHEN the deleted monitor is an existing owner (`isExistingOwner: true`), THE deleteMonitor_Function SHALL NOT delete the Firebase Auth user account.
4. WHEN the deleted monitor is not an existing owner (`isExistingOwner: false`), THE deleteMonitor_Function SHALL delete the Firebase Auth user account.
5. THE deleteMonitor_Function SHALL delete `owners/{ownerId}/users/{monitorUid}/` and `userIndex/{monitorUid}/` regardless of `isExistingOwner`.
6. IF the caller is not authenticated or does not own the monitor record, THEN THE deleteMonitor_Function SHALL return a `permission-denied` error.

---

### Requirement 7: Owner UI — Dual-Role Warning on Monitors Page

**User Story:** As an owner, I want to see a clear indicator when a monitor I'm adding is already an owner in the system, so that I understand the dual-role setup and set an appropriate monitor password.

#### Acceptance Criteria

1. WHEN an owner enters an email in the "Add Monitor" form and the email is found in Firebase Auth, THE Monitors_Page SHALL display a warning badge indicating the email belongs to an existing owner account.
2. THE Monitors_Page SHALL display the warning before the owner submits the form, so the owner can confirm the intent.
3. WHEN a monitor in the list has `isExistingOwner: true`, THE Monitors_Page SHALL display a visual indicator (e.g., a badge) on that monitor's list entry.
4. THE Monitors_Page SHALL display any unread Notifications from `owners/{ownerId}/notifications/` related to monitor self-service changes (password or email changes).
5. WHEN an owner views a notification, THE Monitors_Page SHALL mark the notification as read by updating the `read` field to `true` in the Notification document.

---

### Requirement 8: Monitor Settings Section

**User Story:** As a monitor, I want a dedicated section in the Settings page to change my monitor password and email, so that I can manage my own credentials independently.

#### Acceptance Criteria

1. WHILE the authenticated user's role is `"monitor"`, THE Settings_Page SHALL display a "Monitor Account" section containing fields to change the monitor password and email.
2. WHILE the authenticated user's role is `"owner"`, THE Settings_Page SHALL NOT display the "Monitor Account" section.
3. THE Settings_Page SHALL require the monitor to enter their current monitor password before accepting a new password or email change.
4. WHEN a monitor submits a password change, THE Settings_Page SHALL call `updateMonitorPassword_Function` and display a success or error toast based on the result.
5. WHEN a monitor submits an email change, THE Settings_Page SHALL call `updateMonitorEmail_Function` and display a success or error toast based on the result.
6. IF the new password and confirm-password fields do not match, THEN THE Settings_Page SHALL display an inline validation error and SHALL NOT call `updateMonitorPassword_Function`.
