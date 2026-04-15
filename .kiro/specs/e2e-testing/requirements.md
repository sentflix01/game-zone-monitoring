# Requirements Document

## Introduction

This feature adds end-to-end (E2E) testing to the Game Zone React application — a football manager / game zone management tool built with React, Vite, Tailwind CSS, and shadcn/ui. The application manages PlayStation consoles (PS4/PS5), gaming sessions, pricing, and reporting for a physical game zone business.

E2E tests will cover the full user journey through the browser, verifying that authentication flows, navigation, and all five core pages (Dashboard, Consoles, Sessions, Report, Settings) behave correctly from a user's perspective.

## Glossary

- **E2E_Test_Suite**: The collection of end-to-end tests that exercise the application through a real browser
- **Test_Runner**: The E2E testing framework responsible for executing tests (e.g., Playwright or Cypress)
- **Auth_Flow**: The sequence of steps the application performs to verify a user's identity via AuthContext
- **Dashboard_Page**: The `/` route displaying live console status, active sessions, and today's earnings
- **Consoles_Page**: The `/consoles` route for managing consoles and starting/ending sessions
- **Sessions_Page**: The `/sessions` route displaying session history with filter tabs
- **Report_Page**: The `/report` route showing daily summaries, charts, and CSV export
- **Settings_Page**: The `/settings` route for configuring hourly pricing rates
- **Console**: A physical PlayStation unit (PS4 or PS5) tracked by the application
- **Session**: A timed gaming session linked to a Console with a player name, start time, and charge amount
- **Pricing**: Hourly rate configuration per console type (PS4 or PS5)
- **Loading_Spinner**: The animated spinner displayed while data is being fetched from the API
- **Test_Environment**: A controlled environment with mocked or seeded API responses used during E2E tests

---

## Requirements

### Requirement 1: E2E Test Framework Setup

**User Story:** As a developer, I want a configured E2E test framework, so that I can write and run browser-based tests against the application.

#### Acceptance Criteria

1. THE E2E_Test_Suite SHALL include a test runner configuration file at the project root
2. THE E2E_Test_Suite SHALL support running tests against the local Vite development server
3. WHEN the test command is executed, THE Test_Runner SHALL launch a headless browser and run all E2E tests
4. THE E2E_Test_Suite SHALL include a base URL configuration that can be overridden via environment variable
5. THE E2E_Test_Suite SHALL produce a test result report indicating pass/fail status for each test

---

### Requirement 2: Authentication Flow Testing

**User Story:** As a developer, I want E2E tests for the authentication flow, so that I can verify users are correctly redirected when unauthenticated and can access the app when authenticated.

#### Acceptance Criteria

1. WHEN a user visits the application without a valid auth token, THE E2E_Test_Suite SHALL verify that the application redirects to the login page
2. WHEN the AuthContext is loading, THE E2E_Test_Suite SHALL verify that the Loading_Spinner is visible and no page content is rendered prematurely
3. WHEN the AuthContext returns an `auth_required` error, THE E2E_Test_Suite SHALL verify that `navigateToLogin` is triggered
4. WHEN the AuthContext returns a `user_not_registered` error, THE E2E_Test_Suite SHALL verify that the UserNotRegisteredError component is displayed
5. WHEN a user is authenticated, THE E2E_Test_Suite SHALL verify that the Layout with navigation is rendered and the Dashboard_Page is accessible

---

### Requirement 3: Navigation and Layout Testing

**User Story:** As a developer, I want E2E tests for the application layout and navigation, so that I can verify all routes are reachable and the navigation UI is correct.

#### Acceptance Criteria

1. WHEN an authenticated user is on any page, THE E2E_Test_Suite SHALL verify that the header displays the "Game Zone" title and "Football Manager" subtitle
2. WHEN an authenticated user clicks a navigation link in the sidebar, THE E2E_Test_Suite SHALL verify that the browser navigates to the corresponding route
3. THE E2E_Test_Suite SHALL verify that all five navigation items (Dashboard, Consoles, Sessions, Report, Settings) are present in the sidebar on desktop viewport
4. WHEN an authenticated user is on a mobile viewport, THE E2E_Test_Suite SHALL verify that the bottom navigation bar is visible and contains all five navigation items
5. WHEN a user navigates to an unknown route, THE E2E_Test_Suite SHALL verify that the PageNotFound component is displayed
6. WHEN a navigation link is active, THE E2E_Test_Suite SHALL verify that the active link has a visually distinct style compared to inactive links

---

### Requirement 4: Dashboard Page Testing

**User Story:** As a developer, I want E2E tests for the Dashboard page, so that I can verify that live stats, console status, and active sessions are displayed correctly.

#### Acceptance Criteria

1. WHEN the Dashboard_Page loads, THE E2E_Test_Suite SHALL verify that the four stat cards (Available, In Use, Active Sessions, Today's Earnings) are rendered
2. WHEN the Dashboard_Page is loading data, THE E2E_Test_Suite SHALL verify that the Loading_Spinner is displayed
3. WHEN consoles are returned by the API, THE E2E_Test_Suite SHALL verify that each console is displayed in the Console Status Grid with its name and status indicator
4. WHEN active sessions exist, THE E2E_Test_Suite SHALL verify that the Active Sessions section is visible and each active session shows the console name and elapsed time
5. WHEN no active sessions exist, THE E2E_Test_Suite SHALL verify that the Active Sessions section is not rendered
6. WHEN the app is not installed as a PWA, THE E2E_Test_Suite SHALL verify that the install app banner is displayed
7. WHEN the "Manage →" link is clicked, THE E2E_Test_Suite SHALL verify that the browser navigates to the Consoles_Page

---

### Requirement 5: Consoles Page Testing

**User Story:** As a developer, I want E2E tests for the Consoles page, so that I can verify that console management and session lifecycle operations work correctly end-to-end.

#### Acceptance Criteria

1. WHEN the Consoles_Page loads, THE E2E_Test_Suite SHALL verify that all consoles are displayed as cards with their name, type badge, and status indicator
2. WHEN the "Add Console" button is clicked, THE E2E_Test_Suite SHALL verify that the add/edit dialog opens with empty name, PS5 type, and available status fields
3. WHEN a console name is submitted in the add dialog, THE E2E_Test_Suite SHALL verify that the new console appears in the console list after the dialog closes
4. IF the console name field is empty when the save button is clicked, THEN THE E2E_Test_Suite SHALL verify that a toast error message "Console name is required" is displayed
5. WHEN the edit button on a console card is clicked, THE E2E_Test_Suite SHALL verify that the dialog opens pre-populated with the console's current name, type, and status
6. WHEN the delete button on a console card is clicked, THE E2E_Test_Suite SHALL verify that the console is removed from the list and a success toast is shown
7. WHEN the "Start" button on an available console is clicked, THE E2E_Test_Suite SHALL verify that the start session dialog opens showing the console name
8. WHEN a session is started, THE E2E_Test_Suite SHALL verify that the console card transitions to "occupied" status with a pulsing indicator
9. WHEN the "End" button on an occupied console is clicked, THE E2E_Test_Suite SHALL verify that the console returns to "available" status and a success toast with the charged amount is displayed

---

### Requirement 6: Sessions Page Testing

**User Story:** As a developer, I want E2E tests for the Sessions page, so that I can verify that session history, earnings summaries, and filter tabs work correctly.

#### Acceptance Criteria

1. WHEN the Sessions_Page loads, THE E2E_Test_Suite SHALL verify that the Today's Earnings and Total Earnings summary cards are displayed
2. WHEN the Sessions_Page loads with session data, THE E2E_Test_Suite SHALL verify that session rows are rendered with console name, player name, duration, and date
3. WHEN the "active" filter tab is selected, THE E2E_Test_Suite SHALL verify that only sessions with "active" status are shown
4. WHEN the "today" filter tab is selected, THE E2E_Test_Suite SHALL verify that only sessions started on the current date are shown
5. WHEN the "all" filter tab is selected, THE E2E_Test_Suite SHALL verify that all sessions are shown regardless of status or date
6. WHEN no sessions match the active filter, THE E2E_Test_Suite SHALL verify that the "No sessions found" empty state message is displayed
7. WHEN an active session is displayed, THE E2E_Test_Suite SHALL verify that a pulsing blue indicator and "Live" label are shown for that session row

---

### Requirement 7: Report Page Testing

**User Story:** As a developer, I want E2E tests for the Report page, so that I can verify that daily summaries, charts, and CSV export function correctly.

#### Acceptance Criteria

1. WHEN the Report_Page loads with no completed sessions today, THE E2E_Test_Suite SHALL verify that the empty state message "No completed sessions today" is displayed
2. WHEN the Report_Page loads with completed sessions today, THE E2E_Test_Suite SHALL verify that the three summary cards (Today's Earnings, Total Hours Played, Most Used Console) are rendered
3. WHEN the Report_Page loads with completed sessions today, THE E2E_Test_Suite SHALL verify that the console breakdown section is visible with at least one console entry
4. WHEN the Report_Page loads, THE E2E_Test_Suite SHALL verify that the "Revenue — Last 30 Days" line chart is rendered
5. WHEN the "Download CSV" button is clicked, THE E2E_Test_Suite SHALL verify that a file download is triggered with a filename matching the pattern `game-zone-report-YYYY-MM-DD.csv`

---

### Requirement 8: Settings Page Testing

**User Story:** As a developer, I want E2E tests for the Settings page, so that I can verify that pricing configuration can be viewed and saved correctly.

#### Acceptance Criteria

1. WHEN the Settings_Page loads, THE E2E_Test_Suite SHALL verify that the hourly rate inputs for PS5 and PS4 are displayed
2. WHEN the Settings_Page loads with existing pricing data, THE E2E_Test_Suite SHALL verify that the rate inputs are pre-populated with the saved values
3. WHEN a user updates a rate value and clicks "Save Pricing", THE E2E_Test_Suite SHALL verify that a success toast "Pricing saved!" is displayed
4. WHEN the Settings_Page loads, THE E2E_Test_Suite SHALL verify that the "Current Rates" section displays the formatted rate for each console type
5. WHEN a rate is not set, THE E2E_Test_Suite SHALL verify that the Current Rates section displays "Not set" for that console type

---

### Requirement 9: Test Reliability and Isolation

**User Story:** As a developer, I want E2E tests that are reliable and isolated, so that tests do not interfere with each other or depend on external API state.

#### Acceptance Criteria

1. THE E2E_Test_Suite SHALL mock or intercept all API calls to the base44 backend to avoid dependency on live data
2. WHEN a test starts, THE E2E_Test_Suite SHALL reset all mocked API state to a known baseline before each test
3. THE E2E_Test_Suite SHALL use stable test selectors (data-testid attributes or accessible roles) rather than CSS class names or implementation-specific selectors
4. WHEN tests are run in parallel, THE E2E_Test_Suite SHALL ensure each test operates on an independent browser context
5. THE E2E_Test_Suite SHALL complete the full test suite in under 5 minutes on a standard development machine
