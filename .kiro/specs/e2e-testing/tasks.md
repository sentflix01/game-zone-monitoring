# Implementation Plan: E2E Testing

## Overview

Add end-to-end test coverage to the Game Zone React application using Playwright. The implementation proceeds in three phases: (1) instrument source files with `data-testid` attributes, (2) scaffold the Playwright infrastructure, and (3) write the spec files for each page/feature area.

## Tasks

- [-] 1. Install Playwright and configure the test runner
  - Install `@playwright/test` as a dev dependency
  - Create `e2e/playwright.config.ts` with `testDir`, `fullyParallel`, `reporter: 'html'`, `baseURL` (defaulting to `http://localhost:5173`), `webServer` pointing at `npm run dev`, and a single Chromium project
  - Add `"test:e2e": "playwright test"` script to `package.json`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [~] 2. Add `data-testid` attributes to `src/App.jsx` and `src/components/UserNotRegisteredError.jsx`
  - Add `data-testid="loading-spinner"` to the loading spinner element in `App.jsx`
  - Add `data-testid="user-not-registered-error"` to the root element of `UserNotRegisteredError.jsx`
  - _Requirements: 2.2, 2.4_

- [~] 3. Add `data-testid` attributes to `src/components/Layout.jsx` and `src/lib/PageNotFound.jsx`
  - Add `data-testid="header-title"` and `data-testid="header-subtitle"` to the header elements
  - Add `data-testid="sidebar-nav"` to the desktop sidebar navigation container
  - Add `data-testid="bottom-nav"` to the mobile bottom navigation container
  - Add `data-testid="nav-link-{label}"` (lowercase) to each navigation link (dashboard, consoles, sessions, report, settings)
  - Add `data-testid="page-not-found"` to the root element of `PageNotFound.jsx`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [~] 4. Add `data-testid` attributes to `src/pages/Dashboard.jsx`
  - Add `data-testid="stat-card-{label}"` to each of the four stat cards (available, in-use, active-sessions, todays-earnings)
  - Add `data-testid="console-status-grid"` to the console grid container
  - Add `data-testid="console-card-{name}"` to each console card (using the console name as identifier)
  - Add `data-testid="active-sessions"` to the active sessions section container
  - Add `data-testid="manage-link"` to the "Manage →" link
  - Add `data-testid="install-banner"` to the PWA install banner
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7_

- [~] 5. Add `data-testid` attributes to `src/pages/Consoles.jsx`
  - Add `data-testid="add-console-btn"` to the Add Console button
  - Add `data-testid="console-card-{name}"` to each console card
  - Add `data-testid="edit-console-btn"` and `data-testid="delete-console-btn"` to the respective buttons on each card
  - Add `data-testid="start-session-btn"` and `data-testid="end-session-btn"` to the session control buttons
  - Add `data-testid="console-dialog"` to the add/edit dialog, `data-testid="console-name-input"` to the name field, and `data-testid="console-save-btn"` to the save button
  - Add `data-testid="session-dialog"` to the start session dialog
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

- [~] 6. Add `data-testid` attributes to `src/pages/Sessions.jsx`
  - Add `data-testid="today-earnings-card"` and `data-testid="total-earnings-card"` to the summary cards
  - Add `data-testid="filter-tab-{label}"` to each filter tab (active, today, all)
  - Add `data-testid="session-row"` to each session row
  - Add `data-testid="sessions-empty-state"` to the empty state message element
  - Add `data-testid="live-indicator"` to the pulsing live indicator on active session rows
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [~] 7. Add `data-testid` attributes to `src/pages/Report.jsx` and `src/pages/Settings.jsx`
  - In `Report.jsx`: add `data-testid="report-empty-state"`, `data-testid="report-earnings-card"`, `data-testid="report-hours-card"`, `data-testid="report-most-used-card"`, `data-testid="console-breakdown"`, `data-testid="revenue-chart"`, `data-testid="download-csv-btn"`
  - In `Settings.jsx`: add `data-testid="ps5-rate-input"`, `data-testid="ps4-rate-input"`, `data-testid="save-pricing-btn"`, `data-testid="current-rates"`, `data-testid="rate-display-{type}"` (ps5, ps4)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [~] 8. Create test fixtures and helper modules
  - [~] 8.1 Create `e2e/fixtures/consoles.ts` exporting `mockConsoles` array with at least one available PS5, one occupied PS5, and one available PS4
    - _Requirements: 9.1, 9.2_
  - [~] 8.2 Create `e2e/fixtures/sessions.ts` exporting `mockActiveSessions` (one active session) and `mockCompletedSessions` (a few completed sessions from today)
    - _Requirements: 9.1, 9.2_
  - [~] 8.3 Create `e2e/fixtures/pricing.ts` exporting `mockPricing` with PS5 and PS4 hourly rates
    - _Requirements: 9.1, 9.2_
  - [~] 8.4 Create `e2e/helpers/auth.ts` with `injectAuthToken(page)` (writes mock token to `localStorage` under `base44_access_token`) and `clearAuthToken(page)`
    - _Requirements: 2.1, 2.5, 9.3_
  - [~] 8.5 Create `e2e/helpers/routes.ts` with `registerApiMocks(page, overrides?)` that installs `page.route()` handlers for all base44 API endpoints, returns fixture data by default, and registers a catch-all 503 handler for unmatched `/api/` URLs
    - _Requirements: 9.1, 9.2_
  - [~] 8.6 Create `e2e/helpers/selectors.ts` exporting the `SEL` constants object covering all `data-testid` selectors for every page and component
    - _Requirements: 9.3_

- [~] 9. Checkpoint — verify infrastructure
  - Ensure `playwright.config.ts` is valid by running `npx playwright test --list` (should list 0 tests without errors)
  - Ensure all fixture and helper files compile without TypeScript errors
  - Ask the user if any questions arise before proceeding to spec files.

- [~] 10. Write `e2e/tests/auth.spec.ts`
  - `beforeEach`: clear auth token, register API mocks
  - Test 2.1: unauthenticated visit triggers redirect to login (public settings returns 403 `auth_required`)
  - Test 2.2: loading state shows spinner and no page content
  - Test 2.3: `auth_required` error triggers `navigateToLogin`
  - Test 2.4: `user_not_registered` error shows `UserNotRegisteredError` component
  - Test 2.5: authenticated user sees Layout and Dashboard
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [~] 11. Write `e2e/tests/navigation.spec.ts`
  - `beforeEach`: inject auth token, register API mocks
  - Test 3.1: header shows "Game Zone" title and "Football Manager" subtitle
  - Test 3.2: clicking each sidebar nav link navigates to the correct route
  - Test 3.3: all five nav items are present in the sidebar on desktop viewport
  - Test 3.4: on mobile viewport, bottom nav is visible with all five items
  - Test 3.5: navigating to an unknown route shows `PageNotFound`
  - Test 3.6: active nav link has a visually distinct style (e.g., different aria-current or class)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [~] 12. Write `e2e/tests/dashboard.spec.ts`
  - `beforeEach`: inject auth token, register API mocks with `mockConsoles` and `mockActiveSessions`
  - Test 4.1: four stat cards are rendered
  - Test 4.2: loading spinner is visible while data loads (intercept with delayed response)
  - Test 4.3: each console appears in the console status grid with name and status indicator
  - Test 4.4: active sessions section is visible and shows console name and elapsed time
  - Test 4.5: when no active sessions, active sessions section is not rendered
  - Test 4.6: install app banner is displayed when PWA is not installed
  - Test 4.7: clicking "Manage →" navigates to `/consoles`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [~] 13. Write `e2e/tests/consoles.spec.ts`
  - `beforeEach`: inject auth token, register API mocks with `mockConsoles`
  - Test 5.1: all consoles are displayed as cards with name, type badge, and status indicator
  - Test 5.2: clicking "Add Console" opens dialog with empty fields and PS5 default
  - Test 5.3: submitting a console name adds it to the list after dialog closes (update route handler mid-test)
  - Test 5.4: submitting with empty name shows toast "Console name is required"
  - Test 5.5: clicking edit opens dialog pre-populated with console's current values
  - Test 5.6: clicking delete removes the console and shows success toast
  - Test 5.7: clicking "Start" on an available console opens the start session dialog with console name
  - Test 5.8: starting a session transitions the console card to "occupied" with pulsing indicator
  - Test 5.9: clicking "End" on an occupied console returns it to "available" and shows charged amount toast
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

- [~] 14. Write `e2e/tests/sessions.spec.ts`
  - `beforeEach`: inject auth token, register API mocks with mixed session data
  - Test 6.1: Today's Earnings and Total Earnings cards are displayed
  - Test 6.2: session rows show console name, player name, duration, and date
  - Test 6.3: "active" filter tab shows only active sessions
  - Test 6.4: "today" filter tab shows only today's sessions
  - Test 6.5: "all" filter tab shows all sessions
  - Test 6.6: when no sessions match active filter, "No sessions found" empty state is shown
  - Test 6.7: active session row shows pulsing blue indicator and "Live" label
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [~] 15. Write `e2e/tests/report.spec.ts`
  - `beforeEach`: inject auth token, register API mocks
  - Test 7.1: with no completed sessions today, empty state "No completed sessions today" is shown
  - Test 7.2: with completed sessions, three summary cards are rendered
  - Test 7.3: with completed sessions, console breakdown section is visible with at least one entry
  - Test 7.4: "Revenue — Last 30 Days" line chart is rendered
  - Test 7.5: clicking "Download CSV" triggers a file download with filename matching `game-zone-report-YYYY-MM-DD.csv`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [~] 16. Write `e2e/tests/settings.spec.ts`
  - `beforeEach`: inject auth token, register API mocks with `mockPricing`
  - Test 8.1: PS5 and PS4 rate inputs are displayed
  - Test 8.2: rate inputs are pre-populated with saved values from fixture
  - Test 8.3: updating a rate and clicking "Save Pricing" shows success toast "Pricing saved!"
  - Test 8.4: "Current Rates" section displays formatted rate for each console type
  - Test 8.5: when a rate is not set, "Current Rates" shows "Not set" for that type
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [~] 17. Final checkpoint — run the full suite
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `data-testid` instrumentation tasks (2–7) must be completed before writing spec files (10–16)
- The `routes.ts` catch-all 503 handler prevents accidental live API calls during tests
- For the CSV download test (15, Test 7.5), use `page.waitForEvent('download')` before clicking the button
- Toast assertions should be made immediately after the triggering action — toasts are transient
- Avoid `page.waitForTimeout()`; use Playwright's built-in auto-waiting via `expect(locator).toBeVisible()`
