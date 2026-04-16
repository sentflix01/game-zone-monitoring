# Unfinished Tasks and Bugs — Bugfix Design

## Summary

After auditing the codebase, all six bugs described in the requirements are already resolved in the current source. The remaining work is:

1. **Remove `base44Client.js`** — it is a legacy compatibility shim (`export { storageAdapter as base44 }`). All pages import `base44` from it and call `base44.entities.*`. These imports should be updated to use `storageAdapter` directly, and the shim file deleted.
2. **Fix `PageNotFound.jsx`** — it calls `base44.auth.me()` which does not exist on `storageAdapter`. This component should be simplified to remove the auth check entirely (the app has no auth layer).

---

## Bug Status Audit

| Bug | Status | Evidence |
|-----|--------|----------|
| 1.1 Settings hardcoded strings | ✅ Fixed | `Settings.jsx` uses `t()` for all strings |
| 1.2 Report missing `data-tour` attrs | ✅ Fixed | `Report.jsx` has `data-tour="report-sections"`, `data-tour="date-range"`, `data-tour="export-controls"` |
| 1.3 Settings missing `data-tour` attrs | ✅ Fixed | `Settings.jsx` has `data-tour="pricing-form"`, `data-tour="currency-field"`, `data-tour="restart-tour"` |
| 1.4 Missing "Restart Tour" section | ✅ Fixed | `Settings.jsx` renders a restart-tour card with `restartTour()` button |
| 1.5 Back button cross-page navigation | ✅ Fixed | `TourContext.jsx` `prevStep` navigates to previous page's last step |
| 1.6 Unsafe console deletion | ✅ Fixed | `Consoles.jsx` checks `sessions.some(s => s.console_id === id)` and shows error toast |

---

## Remaining Work: Remove base44 Shim

### Current State

`src/api/base44Client.js` re-exports `storageAdapter` under the name `base44`:

```js
export { storageAdapter as base44 } from './storageAdapter';
```

All pages import it as:
```js
import { base44 } from "@/api/base44Client";
// then use: base44.entities.Session.list(...)
```

### Target State

Pages import `storageAdapter` directly:
```js
import { storageAdapter } from "@/api/storageAdapter";
// then use: storageAdapter.entities.Session.list(...)
```

`base44Client.js` is deleted.

### Files to Update

| File | Change |
|------|--------|
| `src/pages/Dashboard.jsx` | Replace `base44` import → `storageAdapter` |
| `src/pages/Consoles.jsx` | Replace `base44` import → `storageAdapter` |
| `src/pages/Sessions.jsx` | Replace `base44` import → `storageAdapter` |
| `src/pages/Players.jsx` | Replace `base44` import → `storageAdapter` |
| `src/pages/Expenses.jsx` | Replace `base44` import → `storageAdapter` |
| `src/pages/Analytics.jsx` | Replace `base44` import → `storageAdapter` |
| `src/pages/Report.jsx` | Replace `base44` import → `storageAdapter` |
| `src/pages/Settings.jsx` | Replace `base44` import → `storageAdapter` |
| `src/lib/PageNotFound.jsx` | Remove `base44` import + auth query entirely |
| `src/api/base44Client.js` | Delete file |

### PageNotFound Simplification

The component currently uses `@tanstack/react-query` to call `base44.auth.me()` and conditionally renders an "Admin Note" block. Since the app has no authentication layer, this block is dead code. The fix is to remove the query and the conditional admin note, leaving a clean 404 page.

---

## Storage Architecture (unchanged)

```
Web / Electron                    Native (iOS / Android)
─────────────────                 ──────────────────────
localStorage                      @capacitor/preferences
    │                                      │
    └──── localClient.js ◄── storageAdapter.js ────┘
                                   │
                              All pages use
                              storageAdapter.entities.*
```

---

## Correctness Properties

**P1 — No orphaned base44 references**: After the migration, no source file in `src/` shall import from `@/api/base44Client` or reference the identifier `base44`.

**P2 — Storage parity**: All CRUD operations that previously called `base44.entities.*` shall call the equivalent `storageAdapter.entities.*` method with identical arguments, preserving all existing data behaviour.

**P3 — PageNotFound renders without errors**: The 404 page shall render without throwing runtime errors regardless of auth state, since no auth layer exists.

**P4 — Build succeeds**: `npm run build` shall complete without errors after the migration.
