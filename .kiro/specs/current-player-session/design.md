# Design Document: Current Player Session

## Overview

This feature enhances `src/pages/Consoles.jsx` to support:
- A **Current Player** quick-fill button per console (persisted to localStorage)
- A **Running Game List** with per-game name + price entries before committing
- A **Running Total** display updated in real time
- A **two-row session display** on each console card (previous completed + current active)
- Full **per-console state isolation**

The feature is additive — it extends the existing session dialog and console card without replacing the underlying `Session` entity storage or the `storageAdapter` pattern.

---

## Architecture

The feature lives entirely within `Consoles.jsx` (and its child UI). No new files, routes, or API layers are needed.

```mermaid
flowchart TD
    A[Console Card] -->|"Start" click| B[Session Dialog]
    B --> C{Current Player stored?}
    C -->|yes| D[Show Current Player Button]
    C -->|no| E[No button shown]
    D -->|click| F[Pre-fill player name input]
    B --> G[Player name input]
    G -->|non-empty| H[Add Game form visible]
    H -->|Add| I[Running List]
    I --> J[Running Total]
    B -->|Start Button| K[Commit Session]
    K --> L[storageAdapter.Session.create]
    K --> M[localStorage: gamezone_current_player_{id}]
    K --> N[Console Card: two-row display]
    B -->|Close/Cancel| O[Discard Running List]
```

State flows are local to the component. `currentPlayers` (a map of `consoleId → playerName`) is the only state that is persisted outside the component lifecycle, using `localStorage` directly (not through `storageAdapter`, since it is UI preference state, not business data).

---

## Components and Interfaces

### New `useState` hooks in `Consoles.jsx`

| Hook | Type | Purpose |
|---|---|---|
| `currentPlayers` | `Record<string, string>` | Map of `consoleId → lastPlayerName`, loaded from localStorage on mount |
| `runningGames` | `GameEntry[]` | Ordered list of games added in the current dialog session |
| `gameInput` | `{ name: string, price: string }` | Controlled inputs for the Add Game form |
| `gameInputError` | `string \| null` | Validation error message for the Add Game form |

Existing hooks (`playerName`, `sessionDialog`, `pastPlayers`, etc.) are retained unchanged.

### `GameEntry` shape (in-memory only, not persisted separately)

```js
{ name: string, price: number }
```

### Session Dialog changes

The dialog gains three new sections below the player name input:

1. **Current Player Button** — rendered only when `currentPlayers[sessionDialog?.id]` is set.
2. **Add Game form** — rendered only when `playerName.trim()` is non-empty. Contains a game name text input, a price number input, an "Add" button, and an inline validation error.
3. **Running List + Running Total** — rendered when `runningGames.length > 0`. Each row shows game name and price with a remove (×) button. Below the list: "Total: {currency}{runningTotal}".

The existing **Start** button is retained. Its behavior changes: if `runningGames` is non-empty, `amount_charged` is set to `runningTotal`; otherwise it falls back to the existing pricing-rate logic (preserving backward compatibility).

### Console Card changes

The active session block is replaced by a two-row display:

- **Row 1 (previous completed)** — shown only when `previousSession[consoleId]` exists. Displays player name, game count, and amount charged.
- **Row 2 (current active)** — shown only when an active session exists. Displays player name, elapsed time, and running total (from the active session's `games` array sum).

`previousSession` is derived at render time from the `sessions` state (most recently completed session per console), so no extra state hook is needed.

---

## Data Models

### Session record schema extension

The `Session` entity gains one optional field:

```js
{
  // existing fields (unchanged)
  id: string,
  console_id: string,
  console_name: string,
  console_type: string,
  player_name: string,
  start_time: string,       // ISO 8601
  end_time: string,         // ISO 8601, set on completion
  duration_minutes: number,
  amount_charged: number,
  status: "active" | "completed",

  // NEW optional field
  games: GameEntry[]        // default [] when not provided; populated at session start
}
```

`games` is written once at session creation (when Start is clicked) and never mutated afterward. Existing sessions without a `games` field are treated as `games: []` everywhere in the UI.

### localStorage key for Current Player persistence

```
gamezone_current_player_{consoleId}
```

- Written: when Start is clicked (after session is committed)
- Read: on component mount (inside `load()`) and when the session dialog opens
- Cleared: never (the last player persists until overwritten by a new session)

On mount, `load()` reads all console IDs and builds the `currentPlayers` map:

```js
const cp = {};
for (const c of consoles) {
  const stored = localStorage.getItem(`gamezone_current_player_${c.id}`);
  if (stored) cp[c.id] = stored;
}
setCurrentPlayers(cp);
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Current player button visibility

*For any* console, the Current Player Button is displayed in the Session Dialog if and only if a non-empty current player name is stored for that console's ID.

**Validates: Requirements 1.1, 1.3**

---

### Property 2: Current player button pre-fills input

*For any* console with a stored current player name, clicking the Current Player Button sets the player name input value to exactly that stored name.

**Validates: Requirements 1.2**

---

### Property 3: Per-console current player isolation

*For any* two distinct consoles A and B, writing a current player for console A does not change the current player stored for console B.

**Validates: Requirements 1.4, 5.1**

---

### Property 4: Add Game form visibility

*For any* session dialog state, the Add Game input area is visible if and only if the player name input is non-empty (after trimming whitespace).

**Validates: Requirements 2.1**

---

### Property 5: Running list ordering

*For any* sequence of valid game additions, the Running List displays entries in the order they were added, with the most recently added entry at the bottom.

**Validates: Requirements 2.2**

---

### Property 6: Running total equals sum of game prices

*For any* Running List of game entries, the displayed Running Total equals the arithmetic sum of all `price` values in the list.

**Validates: Requirements 2.3, 2.4**

---

### Property 7: Input fields cleared after adding a game

*For any* valid game entry submission, after the entry is appended to the Running List, both the game name input and the price input are empty.

**Validates: Requirements 2.5**

---

### Property 8: Invalid game entry rejected

*For any* attempted game addition where the game name is empty (or whitespace-only) or the price is non-positive (≤ 0), the Running List remains unchanged and a validation error is displayed.

**Validates: Requirements 2.6**

---

### Property 9: Session record contains games and running total

*For any* player name and non-empty Running List, clicking Start creates exactly one Session record whose `games` array equals the Running List and whose `amount_charged` equals the Running Total.

**Validates: Requirements 3.1**

---

### Property 10: Current player updated on commit

*For any* console and player name, after clicking Start, the value stored at `gamezone_current_player_{consoleId}` equals the player name that was entered.

**Validates: Requirements 3.2**

---

### Property 11: Running list cleared on commit

*For any* session dialog state, after clicking Start, the Running List is empty.

**Validates: Requirements 3.3**

---

### Property 12: Console card shows at most two session rows

*For any* console with any number of completed sessions, the Console Card displays at most two session rows: the single most-recently-completed session row and the current active session row. When a new session is committed, the previous completed row is replaced.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

---

### Property 13: Completed session row renders required fields

*For any* completed session, the Session Summary Row rendered on the Console Card contains the player name, the count of games played (`games.length`), and the total amount charged.

**Validates: Requirements 4.5**

---

### Property 14: Active session row renders required fields

*For any* active session, the active row rendered on the Console Card contains the current player name, the elapsed time in minutes, and the Running Total of games added so far.

**Validates: Requirements 4.6**

---

### Property 15: Console non-interference

*For any* two distinct consoles A and B, starting or modifying a session on console A does not change the session state, current player, or running list displayed for console B.

**Validates: Requirements 5.2, 5.3**

---

### Property 16: Cancel discards running list, preserves current player

*For any* session dialog state, closing the dialog without clicking Start results in an empty Running List and leaves the stored current player for that console unchanged.

**Validates: Requirements 5.4**

---

## Error Handling

| Scenario | Handling |
|---|---|
| Add Game with empty name | Inline error: "Game name is required"; entry not added |
| Add Game with price ≤ 0 | Inline error: "Price must be greater than 0"; entry not added |
| Start with no player name | Existing behavior preserved: player defaults to "Anonymous" |
| Start with empty Running List | Existing timed-session behavior preserved (amount_charged from pricing rate) |
| localStorage read failure | Silently ignored; `currentPlayers` defaults to `{}` |
| localStorage write failure | Silently ignored; session is still committed to storageAdapter |

---

## Testing Strategy

### Unit tests

Focus on specific examples, edge cases, and integration points:

- Session dialog renders Current Player Button when `currentPlayers` has an entry for the console
- Session dialog does NOT render Current Player Button when no entry exists
- Clicking Current Player Button sets `playerName` state to the stored name
- Add Game form is hidden when player name is empty, visible when non-empty
- Adding a valid game appends to the list and clears inputs
- Adding a game with empty name shows error and does not append
- Adding a game with price = 0 shows error and does not append
- Adding a game with price = -1 shows error and does not append
- `startSession` with non-empty `runningGames` creates session with correct `games` and `amount_charged`
- `startSession` with empty `runningGames` creates session with `games: []` and pricing-rate amount
- Console card shows at most 2 rows
- Closing dialog without Start clears `runningGames` and does not update `currentPlayers`

### Property-based tests

Use **fast-check** (already compatible with Vite/Vitest) with a minimum of **100 runs per property**.

Each test is tagged with:
`// Feature: current-player-session, Property {N}: {property_text}`

| Property | Test description |
|---|---|
| P1 | For arbitrary console IDs and optional stored names, button visibility matches stored state |
| P2 | For arbitrary stored player names, button click always sets input to that exact name |
| P3 | For arbitrary pairs of console IDs, writing to one never affects the other |
| P6 | For arbitrary arrays of positive prices, displayed total equals `prices.reduce((a,b)=>a+b, 0)` |
| P8 | For arbitrary strings (empty, whitespace, valid) and arbitrary numbers (≤0, >0), validation rejects iff name is blank or price ≤ 0 |
| P9 | For arbitrary player names and game lists, committed session record matches inputs exactly |
| P10 | For arbitrary console IDs and player names, localStorage key equals player name after commit |
| P12 | For arbitrary sequences of session commits, card never renders more than 2 rows |
| P13 | For arbitrary completed sessions (with random games arrays), rendered row contains name, count, and amount |
| P15 | For arbitrary pairs of consoles, mutating one console's state leaves the other's state unchanged |
| P16 | For arbitrary dialog states, cancel always results in empty running list and unchanged current player |

Properties P4, P5, P7, P11, P14 are adequately covered by the unit tests listed above given their straightforward UI-state nature.
