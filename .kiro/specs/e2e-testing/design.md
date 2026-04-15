# Design Document: E2E Testing

## Overview

This design covers adding end-to-end (E2E) test coverage to the Game Zone React application using **Playwright**. Playwright is chosen over Cypress because it supports multiple browsers out of the box, has first-class support for network request interception (essential for mocking the base44 API), runs headlessly in CI with no extra configuration, and has a modern async/await API that fits naturally with the Vite + React stack.

The test suite will cover authentication flows, navigation, and all five core pages. All API calls to the base44 backend will be intercepted and replaced with fixture data so tests are deterministic and do not depend on live infrastructure.

### Framework Choice: Playwright

| Criterion | Playwright | Cypress |
|---|---|---|
| Multi-browser | Chrome, Firefox, WebKit | Chrome, Firefox, Edge |
| Network mocking | `page.route()` — built-in | `cy.intercept()` — built-in |
| Parallel isolation | Browser contexts (lightweight) | Separate browser instances |
| Vite integration | Works out of the box | Works out of the box |
| TypeScript support | First-class | Good |
| CI headless | Zero config | Requires `--headless` flag |

---

## Architecture

```mermaid
graph TD
    subgraph "Test Execution"
        PW[Playwright Test Runner]
        PW --> CTX[Browser Context per test]
        CTX --> PAGE[Page object]
    end

    subgraph "Network Layer"
        PAGE -->|page.route()| MOCK[API Mock Layer]
        MOCK --> FIX[Fixture Data]
    end

    subgraph "Application Under Test"
        PAGE -->|HTTP| VITE[Vite Dev Server :5173]
        VITE --> APP[React App]
        APP --> AUTH[AuthContext]
        APP --> PAGES[Pages]
    end

    subgraph "Test Helpers"
        AUTH_HELPER[auth.ts — inject auth state]
        FIXTURES[fixtures/ — mock API responses]
        SELECTORS[selectors.ts — data-testid constants]
    end
```

The test runner starts the Vite dev server (via `webServer` config), then for each test:
1. Creates a fresh browser context (isolated cookies, localStorage, network)
2. Installs route handlers to intercept base44 API calls
3. Injects a mock auth token into localStorage to simulate an authenticated user
4. Navigates to the page under test
5. Asserts on visible UI elements using `data-testid` attributes and ARIA roles

---

## Components and Interfaces

### Directory Structure

```
e2e/
├── playwright.config.ts          # Playwright configuration
├── fixtures/
│   ├── consoles.ts               # Mock Console entity data
│   ├── sessions.ts               # Mock Session entity data
│   └── pricing.ts                # Mock Pricing entity data
├── helpers/
│   ├── auth.ts                   # Auth state injection helpers
│   ├── routes.ts                 # API route mock registration
│   └── selectors.ts              # data-testid constants
└── tests/
    ├── auth.spec.ts              # Requirement 2
    ├── navigation.spec.ts        # Requirement 3
    ├── dashboard.spec.ts         # Requirement 4
    ├── consoles.spec.ts          # Requirement 5
    ├── sessions.spec.ts          # Requirement 6
    ├── report.spec.ts            # Requirement 7
    └── settings.spec.ts          # Requirement 8
```

### `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### `helpers/auth.ts`

Provides two helpers:

- `injectAuthToken(page)` — writes a mock `access_token` into `localStorage` under the key `base44_access_token` before navigation, simulating an authenticated session
- `clearAuthToken(page)` — removes the token to simulate an unauthenticated user

The auth token injection must happen before the page loads so `app-params.js` picks it up from `localStorage` on startup.

### `helpers/routes.ts`

The app now uses a pure local `localStorage`-based data layer (`localClient`). There are no external API calls to intercept. Instead, tests seed the `localStorage` key `gamezone_db` directly before each test with fixture data, and clear it after.

Each helper accepts an optional override so individual tests can customize the seeded state (e.g., empty arrays, specific console statuses).

### `helpers/selectors.ts`

Centralizes all `data-testid` attribute names as constants:

```typescript
export const SEL = {
  loadingSpinner: '[data-testid="loading-spinner"]',
  header: {
    title: '[data-testid="header-title"]',
    subtitle: '[data-testid="header-subtitle"]',
  },
  nav: {
    sidebar: '[data-testid="sidebar-nav"]',
    bottomNav: '[data-testid="bottom-nav"]',
    link: (label: string) => `[data-testid="nav-link-${label.toLowerCase()}"]`,
  },
  dashboard: {
    statCard: (label: string) => `[data-testid="stat-card-${label}"]`,
    consoleGrid: '[data-testid="console-status-grid"]',
    consoleCard: (name: string) => `[data-testid="console-card-${name}"]`,
    activeSessions: '[data-testid="active-sessions"]',
    manageLink: '[data-testid="manage-link"]',
    installBanner: '[data-testid="install-banner"]',
  },
  consoles: {
    addButton: '[data-testid="add-console-btn"]',
    consoleCard: (name: string) => `[data-testid="console-card-${name}"]`,
    editButton: '[data-testid="edit-console-btn"]',
    deleteButton: '[data-testid="delete-console-btn"]',
    startButton: '[data-testid="start-session-btn"]',
    endButton: '[data-testid="end-session-btn"]',
    dialog: '[data-testid="console-dialog"]',
    nameInput: '[data-testid="console-name-input"]',
    saveButton: '[data-testid="console-save-btn"]',
    sessionDialog: '[data-testid="session-dialog"]',
  },
  sessions: {
    earningsCard: '[data-testid="today-earnings-card"]',
    totalEarningsCard: '[data-testid="total-earnings-card"]',
    filterTab: (label: string) => `[data-testid="filter-tab-${label}"]`,
    sessionRow: '[data-testid="session-row"]',
    emptyState: '[data-testid="sessions-empty-state"]',
    liveIndicator: '[data-testid="live-indicator"]',
  },
  report: {
    emptyState: '[data-testid="report-empty-state"]',
    earningsCard: '[data-testid="report-earnings-card"]',
    hoursCard: '[data-testid="report-hours-card"]',
    mostUsedCard: '[data-testid="report-most-used-card"]',
    consoleBreakdown: '[data-testid="console-breakdown"]',
    revenueChart: '[data-testid="revenue-chart"]',
    downloadCsvBtn: '[data-testid="download-csv-btn"]',
  },
  settings: {
    ps5RateInput: '[data-testid="ps5-rate-input"]',
    ps4RateInput: '[data-testid="ps4-rate-input"]',
    savePricingBtn: '[data-testid="save-pricing-btn"]',
    currentRates: '[data-testid="current-rates"]',
    rateDisplay: (type: string) => `[data-testid="rate-display-${type.toLowerCase()}"]`,
  },
  userNotRegistered: '[data-testid="user-not-registered-error"]',
  pageNotFound: '[data-testid="page-not-found"]',
};
```

### `fixtures/`

Each fixture file exports typed arrays of mock entity objects matching the shapes used by the app:

```typescript
// fixtures/consoles.ts
export const mockConsoles = [
  { id: 'c1', name: 'PS5 #1', type: 'PS5', status: 'available' },
  { id: 'c2', name: 'PS5 #2', type: 'PS5', status: 'occupied' },
  { id: 'c3', name: 'PS4 #1', type: 'PS4', status: 'available' },
];

// fixtures/sessions.ts
export const mockActiveSessions = [
  {
    id: 's1', console_id: 'c2', console_name: 'PS5 #2',
    console_type: 'PS5', player_name: 'Alice',
    start_time: new Date(Date.now() - 30 * 60000).toISOString(),
    status: 'active',
  },
];

// fixtures/pricing.ts
export const mockPricing = [
  { id: 'p1', console_type: 'PS5', hourly_rate: 10 },
  { id: 'p2', console_type: 'PS4', hourly_rate: 7 },
];
```

---

## Data Models

### Mock API Response Shape

The base44 SDK wraps entity calls. Route handlers must return the raw array/object the SDK unwraps:

```typescript
// Entity list response
{ data: T[] }

// Entity single response
{ data: T }

// Auth /me response
{ data: { id: 'user1', email: 'test@example.com', full_name: 'Test User' } }

// Public settings success
{ data: { id: 'app1', public_settings: {} } }

// Auth error (403)
{ status: 403, body: { extra_data: { reason: 'auth_required' } } }
```

### `data-testid` Attribute Convention

Attributes follow the pattern `{component}-{element}[-{identifier}]`:
- `data-testid="loading-spinner"` — the global loading spinner
- `data-testid="nav-link-dashboard"` — sidebar nav link for Dashboard
- `data-testid="console-card-PS5 #1"` — a console card identified by name
- `data-testid="stat-card-available"` — a stat card identified by its label

---

## Error Handling

### Network Failures in Tests

If a route handler is not registered for a URL the app calls, Playwright will let the request through to the real network. To prevent accidental live API calls:

- The `routes.ts` helper registers a catch-all handler that returns a 503 for any unmatched base44 API URL
- Tests that intentionally test error states override specific routes to return error responses

### Flaky Test Mitigation

- All assertions use `expect(locator).toBeVisible()` with Playwright's built-in auto-waiting (default 5s timeout)
- Avoid `page.waitForTimeout()` — use `waitForSelector` or `waitForResponse` instead
- Toast notifications are transient; assert them immediately after the triggering action using `expect(page.getByText(...)).toBeVisible()`
- For the CSV download test, use `page.waitForEvent('download')` before clicking the button

### Auth State Isolation

Each test file uses `test.beforeEach` to reset auth state and re-register route handlers. This prevents state leakage between tests even when running in the same worker.

---

## Testing Strategy

### Why PBT Does Not Apply

This feature is E2E test infrastructure. The acceptance criteria describe UI behaviors, browser interactions, and framework configuration — none of which are pure functions with a wide input space amenable to property-based testing. The appropriate testing approach is:

- **Example-based E2E tests** for each acceptance criterion
- **Fixture-driven mocking** to cover different data states (empty, populated, error)
- **Smoke checks** for framework setup (config file exists, test command runs)

### Test Organization

Each spec file maps to one requirement. Tests within a file are independent — no shared state between `test()` blocks.

```
auth.spec.ts        → Requirement 2 (5 tests)
navigation.spec.ts  → Requirement 3 (6 tests)
dashboard.spec.ts   → Requirement 4 (7 tests)
consoles.spec.ts    → Requirement 5 (9 tests)
sessions.spec.ts    → Requirement 6 (7 tests)
report.spec.ts      → Requirement 7 (5 tests)
settings.spec.ts    → Requirement 8 (5 tests)
```

### API Mocking Strategy

The app makes all API calls through `base44.entities.*` and `base44.auth.*`, which ultimately hit `/api/` routes. Playwright's `page.route()` intercepts these at the network level before they leave the browser:

```typescript
// In beforeEach
await page.route('**/api/entities/Console/**', async route => {
  await route.fulfill({ json: { data: mockConsoles } });
});
```

For tests that need to verify state changes (e.g., console added to list), the route handler is updated mid-test to return the new state, then the page is re-queried.

### Auth Simulation

Auth is always local — `AuthContext` returns a hardcoded local user with no external calls. Tests do not need to inject tokens or mock auth endpoints. The app renders immediately without any auth loading state.

### Stable Selectors

All interactive and assertable elements in the app source will receive `data-testid` attributes. This decouples tests from CSS class names (which change with Tailwind refactors) and from text content (which may be localized or updated).

ARIA roles are used as a secondary selector strategy for standard elements (buttons, inputs, dialogs) where `data-testid` would be redundant.

### Parallel Execution

Playwright runs each spec file in a separate worker by default (`fullyParallel: true`). Each test gets its own browser context, so cookies, localStorage, and network handlers are fully isolated. No shared database or server state is involved since all API calls are mocked.

### Performance Target

With 44 tests across 7 spec files running in parallel on Chromium, the full suite should complete well under 5 minutes on a standard development machine. Each test is expected to complete in 2–5 seconds given the mocked network layer eliminates real API latency.

### `data-testid` Attribute Additions Required

The following source files need `data-testid` attributes added:

| File | Elements to annotate |
|---|---|
| `src/App.jsx` | Loading spinner, `UserNotRegisteredError` wrapper |
| `src/components/Layout.jsx` | Header title/subtitle, sidebar nav, bottom nav, nav links |
| `src/lib/PageNotFound.jsx` | Root element |
| `src/pages/Dashboard.jsx` | Stat cards, console grid, console cards, active sessions section, manage link, install banner |
| `src/pages/Consoles.jsx` | Add button, console cards, edit/delete/start/end buttons, dialogs, inputs |
| `src/pages/Sessions.jsx` | Earnings cards, filter tabs, session rows, empty state, live indicator |
| `src/pages/Report.jsx` | Empty state, summary cards, console breakdown, chart, download button |
| `src/pages/Settings.jsx` | Rate inputs, save button, current rates section, rate displays |
| `src/components/UserNotRegisteredError.jsx` | Root element |
