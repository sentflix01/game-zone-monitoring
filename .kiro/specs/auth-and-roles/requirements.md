# Requirements Document

## Introduction

This feature adds authentication and role-based authorization to the Game Zone monitoring app. Users must log in via phone number OTP or Google OAuth before accessing the app. Two roles exist: **admin** and **user**. Admins have full access including financial data, configuration, and management actions. Regular users can view and operate sessions but cannot access financial summaries, expenses, analytics, or perform destructive/configuration actions. The auth layer is built on Firebase Auth (phone OTP + Google OAuth), which works across web (PWA), Android (Capacitor), iOS (Capacitor), and desktop (Electron). All app data continues to be stored in localStorage/Capacitor Preferences as-is.

---

## Glossary

- **Auth_System**: The Firebase Auth-backed authentication and authorization layer of the app.
- **User**: Any authenticated person using the app.
- **Admin**: An authenticated user with the `admin` role, having full access to all features.
- **Regular_User**: An authenticated user with the `user` role, having restricted access.
- **Role**: A string value (`admin` or `user`) stored in the user's Firebase custom claims and mirrored in local storage.
- **Login_Page**: The dedicated screen where unauthenticated visitors authenticate.
- **Protected_Route**: A React Router route that requires authentication to access.
- **Admin_Route**: A React Router route that requires the `admin` role to access.
- **OTP**: One-time password sent via SMS to a phone number for authentication.
- **Google_OAuth**: Authentication via Google Sign-In using OAuth 2.0.
- **Firebase_Auth**: The Firebase Authentication service used as the identity provider.
- **Session_Token**: The Firebase ID token stored locally and used to restore auth state on app restart.
- **AuthContext**: The React context that exposes the current user, role, and auth actions to the component tree.
- **RoleGuard**: A React component that conditionally renders children based on the current user's role.

---

## Requirements

### Requirement 1: Authentication Gate

**User Story:** As a visitor, I want to be required to log in before accessing the app, so that only authorized staff can view or operate the game zone.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to any route, THE Auth_System SHALL redirect the user to the Login_Page.
2. WHEN an authenticated user navigates to the Login_Page, THE Auth_System SHALL redirect the user to the Dashboard.
3. THE Login_Page SHALL display two sign-in options: phone number OTP and Google OAuth.
4. WHILE the Auth_System is resolving the persisted session on app startup, THE Auth_System SHALL display a loading indicator and SHALL NOT render any Protected_Route content.
5. IF Firebase_Auth is unreachable on app startup and a valid cached Session_Token exists, THEN THE Auth_System SHALL restore the user's session from the cached token and allow access.

---

### Requirement 2: Phone Number OTP Login

**User Story:** As a staff member, I want to log in with my phone number via OTP, so that I can authenticate without needing a Google account.

#### Acceptance Criteria

1. WHEN a user submits a valid phone number on the Login_Page, THE Auth_System SHALL send an OTP to that phone number via Firebase_Auth.
2. WHEN a user submits the correct OTP, THE Auth_System SHALL authenticate the user and navigate to the Dashboard.
3. IF a user submits an incorrect OTP, THEN THE Auth_System SHALL display a descriptive error message and allow the user to retry.
4. IF a user submits an OTP after it has expired, THEN THE Auth_System SHALL display an expiry error and allow the user to request a new OTP.
5. THE Auth_System SHALL enforce Firebase_Auth's built-in rate limiting on OTP send requests.
6. THE Login_Page SHALL render a reCAPTCHA verifier (invisible or visible) as required by Firebase phone auth before sending an OTP.

---

### Requirement 3: Google OAuth Login

**User Story:** As a staff member, I want to log in with my Google account, so that I can authenticate quickly without entering a phone number.

#### Acceptance Criteria

1. WHEN a user clicks the Google sign-in button on the Login_Page, THE Auth_System SHALL initiate the Google OAuth flow via Firebase_Auth.
2. WHEN the Google OAuth flow completes successfully, THE Auth_System SHALL authenticate the user and navigate to the Dashboard.
3. IF the user cancels the Google OAuth flow, THEN THE Auth_System SHALL return the user to the Login_Page without displaying an error.
4. IF the Google OAuth flow fails due to a network or provider error, THEN THE Auth_System SHALL display a descriptive error message on the Login_Page.
5. WHERE the app is running on Android or iOS via Capacitor, THE Auth_System SHALL use the `@codetrix-studio/capacitor-google-auth` plugin to perform the Google OAuth flow natively.

---

### Requirement 4: Logout

**User Story:** As an authenticated user, I want to log out, so that my session is terminated and the app is secured.

#### Acceptance Criteria

1. WHEN a user triggers the logout action, THE Auth_System SHALL sign out from Firebase_Auth, clear the cached Session_Token, and redirect the user to the Login_Page.
2. THE Auth_System SHALL expose a logout action accessible from the app's navigation or settings area.
3. WHEN logout completes, THE Auth_System SHALL clear all in-memory auth state so that no user data is accessible without re-authenticating.

---

### Requirement 5: Role Assignment and Persistence

**User Story:** As an admin, I want roles to be assigned and persisted reliably, so that access control is enforced consistently across app restarts and platforms.

#### Acceptance Criteria

1. THE Auth_System SHALL support exactly two roles: `admin` and `user`.
2. WHEN a new user authenticates for the first time, THE Auth_System SHALL assign the `user` role by default.
3. THE Auth_System SHALL store the authenticated user's role in localStorage/Capacitor Preferences under a dedicated key so that the role is available immediately on app startup without a network round-trip.
4. WHEN the app starts and a cached session exists, THE Auth_System SHALL read the role from local storage and apply it until the Firebase ID token is refreshed.
5. THE Auth_System SHALL provide a mechanism for an existing admin to promote another user to the `admin` role within the app's Settings page.
6. WHEN a user's role changes, THE Auth_System SHALL update the locally cached role immediately so that UI restrictions take effect without requiring a logout.

---

### Requirement 6: Admin-Only Routes and Actions

**User Story:** As an admin, I want exclusive access to sensitive pages and actions, so that financial data and configuration are protected from regular users.

#### Acceptance Criteria

1. WHEN a Regular_User navigates to `/analytics`, THE Auth_System SHALL redirect the user to the Dashboard and display an "Access denied" message.
2. WHEN a Regular_User navigates to `/expenses`, THE Auth_System SHALL redirect the user to the Dashboard and display an "Access denied" message.
3. THE Consoles page SHALL render the "Add Console" button only when the current user has the `admin` role.
4. THE Consoles page SHALL render the edit and delete actions for each console only when the current user has the `admin` role.
5. THE Settings page SHALL render the session rate and currency configuration form only when the current user has the `admin` role.
6. THE Players page SHALL render the "Add Player" and "Delete Player" actions only when the current user has the `admin` role.

---

### Requirement 7: Admin-Only Financial Data Visibility

**User Story:** As an admin, I want profit and expense figures to be hidden from regular users, so that sensitive financial information is not exposed to all staff.

#### Acceptance Criteria

1. WHILE the current user has the `user` role, THE Dashboard SHALL NOT render the P&L cards (Today's P&L and This Month sections).
2. WHILE the current user has the `user` role, THE Dashboard SHALL NOT render the "Today's Earnings" stat card.
3. WHILE the current user has the `user` role, THE Dashboard SHALL render the Available, In Use, and Active Sessions stat cards without modification.
4. WHILE the current user has the `user` role, THE Dashboard SHALL NOT render the "Manage expenses →" and "Full analytics →" links.
5. WHILE the current user has the `admin` role, THE Dashboard SHALL render all stat cards, P&L cards, and navigation links without restriction.

---

### Requirement 8: Navigation Visibility by Role

**User Story:** As a regular user, I want the navigation to only show pages I can access, so that I am not confused by links to restricted areas.

#### Acceptance Criteria

1. WHILE the current user has the `user` role, THE Auth_System SHALL hide the "Expenses" and "Analytics" navigation items.
2. WHILE the current user has the `admin` role, THE Auth_System SHALL display all navigation items.
3. THE Auth_System SHALL enforce route-level access control independently of navigation visibility, so that hiding nav items alone is not the sole security boundary.

---

### Requirement 9: Offline and Cross-Platform Auth Resilience

**User Story:** As a user on a mobile device or PWA, I want the app to remain accessible when offline after I have previously logged in, so that I can continue operating sessions without an internet connection.

#### Acceptance Criteria

1. WHEN the app starts offline and a valid cached Session_Token exists, THE Auth_System SHALL grant access using the cached token without requiring a network call.
2. WHILE the app is offline, THE Auth_System SHALL preserve the user's role from local storage and enforce role-based restrictions as normal.
3. WHILE the app is offline, THE Auth_System SHALL disable the login options and display an "Offline — please connect to sign in" message on the Login_Page if no cached session exists.
4. WHEN the app comes back online after being offline, THE Auth_System SHALL silently refresh the Firebase ID token in the background without interrupting the user.

---

### Requirement 10: i18n Support for Auth UI

**User Story:** As a user, I want all authentication UI text to be available in both English and Amharic, so that the app is accessible to Amharic-speaking staff.

#### Acceptance Criteria

1. THE Login_Page SHALL render all labels, placeholders, button text, and error messages using the app's existing i18n translation system.
2. THE Auth_System SHALL provide translation keys for all auth-related strings in both the English (`en`) and Amharic (`am`) locale files.
3. WHEN the user switches the app language, THE Login_Page SHALL immediately reflect the new language without requiring a page reload.
