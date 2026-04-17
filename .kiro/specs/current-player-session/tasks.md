# Implementation Plan: Current Player Session

## Overview

All changes are confined to `src/pages/Consoles.jsx`. The implementation adds new state hooks, extends the session dialog with a current-player button, game entry form, and running list, updates `startSession()` to persist games and current player, updates the console card to show a two-row session display, and resets transient state on dialog close.

## Tasks

- [x] 1. Add new state hooks and load currentPlayers on mount
  - Add `currentPlayers`, `runningGames`, `gameInput`, `gameInputError` useState hooks
  - Inside `load()`, after fetching consoles, iterate console IDs and read `gamezone_current_player_{c.id}` from localStorage to build the `currentPlayers` map; call `setCurrentPlayers(cp)`
  - _Requirements: 1.4, 5.1_

- [x] 2. Extend startSession() to persist games and current player
  - [x] 2.1 Pass `games` array and `amount_charged` from runningGames into Session.create
    - If `runningGames` is non-empty, set `amount_charged` to `runningGames.reduce((s,g)=>s+g.price,0)` and include `games: runningGames`; otherwise fall back to existing pricing-rate logic with `games: []`
    - After Session.create succeeds, write `localStorage.setItem('gamezone_current_player_' + c.id, playerName || 'Anonymous')` and update `currentPlayers` state
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 2.2 Write property test for session record correctness (Property 9)
    - **Property 9: Session record contains games and running total**
    - **Validates: Requirements 3.1**

  - [x] 2.3 Write property test for current player persistence (Property 10)
    - **Property 10: Current player updated on commit**
    - **Validates: Requirements 3.2**

- [x] 3. Reset transient state when session dialog closes
  - In the `onOpenChange` handler for the Start Session Dialog, reset `runningGames` to `[]`, `gameInput` to `{ name: '', price: '' }`, and `gameInputError` to `null` in addition to `setSessionDialog(null)`
  - Also reset `playerName` to `''` on close (already done for Start path; ensure it also happens on cancel)
  - _Requirements: 3.3, 5.4_

  - [x] 3.1 Write property test for cancel discards running list (Property 16)
    - **Property 16: Cancel discards running list, preserves current player**
    - **Validates: Requirements 5.4**

- [x] 4. Add Current Player Button to Session Dialog
  - Render a button labeled with `currentPlayers[sessionDialog?.id]` immediately above the player name input, but only when `currentPlayers[sessionDialog?.id]` is truthy
  - On click, call `setPlayerName(currentPlayers[sessionDialog.id])`
  - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.1 Write property test for current player button visibility (Property 1)
    - **Property 1: Current player button visibility**
    - **Validates: Requirements 1.1, 1.3**

  - [x] 4.2 Write property test for current player button pre-fills input (Property 2)
    - **Property 2: Current player button pre-fills input**
    - **Validates: Requirements 1.2**

  - [x] 4.3 Write property test for per-console current player isolation (Property 3)
    - **Property 3: Per-console current player isolation**
    - **Validates: Requirements 1.4, 5.1**

- [x] 5. Add Add Game form to Session Dialog
  - Render the Add Game form (game name text input + price number input + "Add" button + inline error) below the player name input, only when `playerName.trim()` is non-empty
  - On "Add" click: validate that name is non-empty and price > 0; if invalid set `gameInputError` and return; otherwise append `{ name: gameInput.name.trim(), price: parseFloat(gameInput.price) }` to `runningGames`, clear `gameInput`, and clear `gameInputError`
  - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [x] 5.1 Write property test for Add Game form visibility (Property 4)
    - **Property 4: Add Game form visibility**
    - **Validates: Requirements 2.1**

  - [x] 5.2 Write property test for invalid game entry rejected (Property 8)
    - **Property 8: Invalid game entry rejected**
    - **Validates: Requirements 2.6**

- [ ] 6. Add Running List and Running Total display to Session Dialog
  - Render the running list below the Add Game form when `runningGames.length > 0`; each row shows game name, price, and a remove (×) button that splices the entry from `runningGames`
  - Below the list render "Total: {runningTotal}" where `runningTotal = runningGames.reduce((s,g)=>s+g.price,0)`
  - _Requirements: 2.2, 2.3, 2.4_

  - [x] 6.1 Write property test for running list ordering (Property 5)
    - **Property 5: Running list ordering**
    - **Validates: Requirements 2.2**

  - [x] 6.2 Write property test for running total equals sum of game prices (Property 6)
    - **Property 6: Running total equals sum of game prices**
    - **Validates: Requirements 2.3, 2.4**

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update Console Card to two-row session display
  - Derive `previousSession` at render time: for each console, find the most recently completed session from `sessions` state (filter `status === 'completed'` and `console_id === c.id`, sort by `end_time` desc, take first)
  - Replace the existing `{active && ...}` block with two conditional rows:
    - Row 1 (previous completed): render when `previousSession` exists — show `player_name`, `games?.length ?? 0` games, `amount_charged`
    - Row 2 (current active): render when `active` exists — show `player_name`, elapsed time in minutes, and sum of `active.games ?? []`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 8.1 Write property test for console card shows at most two session rows (Property 12)
    - **Property 12: Console card shows at most two session rows**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 8.2 Write property test for completed session row renders required fields (Property 13)
    - **Property 13: Completed session row renders required fields**
    - **Validates: Requirements 4.5**

  - [x] 8.3 Write property test for console non-interference (Property 15)
    - **Property 15: Console non-interference**
    - **Validates: Requirements 5.2, 5.3**

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use **fast-check** with a minimum of 100 runs per property
- Each property test file should be tagged: `// Feature: current-player-session, Property {N}: {property_text}`
- `previousSession` is derived at render time from the existing `sessions` state — no extra state hook needed
- localStorage read failures are silently ignored; `currentPlayers` defaults to `{}`
- The `load()` function already fetches completed sessions via `Session.list`; ensure the `sessions` state (currently only active) is supplemented or a separate `completedSessions` state is used for the two-row display
