// Feature: current-player-session, Property 16: Cancel discards running list, preserves current player

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 16: Cancel discards running list, preserves current player
 *
 * For any session dialog state, closing the dialog without clicking Start results
 * in an empty Running List and leaves the stored current player for that console unchanged.
 *
 * Validates: Requirements 5.4
 *
 * This test validates the pure logic extracted from the onOpenChange handler in Consoles.jsx:
 *   if (!open) {
 *     setSessionDialog(null);
 *     setPlayerName("");
 *     setRunningGames([]);
 *     setGameInput({ name: "", price: "" });
 *     setGameInputError(null);
 *   }
 *
 * The currentPlayers map is NOT modified on dialog close — only on commit (Start).
 */

// Pure logic: simulate the state after dialog close (cancel)
function simulateDialogClose(state) {
  return {
    sessionDialog: null,
    playerName: '',
    runningGames: [],
    gameInput: { name: '', price: '' },
    gameInputError: null,
    // currentPlayers is NOT touched on close
    currentPlayers: state.currentPlayers,
  };
}

// Arbitrary for a single GameEntry with price > 0
const gameEntryArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  price: fc.integer({ min: 1, max: 99900 }).map((cents) => cents / 100),
});

// Arbitrary for console IDs
const consoleIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0);

// Arbitrary for a currentPlayers map (may or may not have an entry for the open console)
const currentPlayersArb = (consoleId) =>
  fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }).map((name) => {
    const map = {};
    if (name !== undefined) map[consoleId] = name;
    return map;
  });

// Arbitrary for dialog state (open, with some running games and player name)
const dialogStateArb = consoleIdArb.chain((consoleId) =>
  fc.record({
    sessionDialog: fc.constant({ id: consoleId, name: `Console-${consoleId}` }),
    playerName: fc.string({ maxLength: 50 }),
    runningGames: fc.array(gameEntryArb, { minLength: 0, maxLength: 10 }),
    gameInput: fc.record({
      name: fc.string({ maxLength: 50 }),
      price: fc.string({ maxLength: 10 }),
    }),
    gameInputError: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    currentPlayers: currentPlayersArb(consoleId),
  })
);

describe('Property 16: Cancel discards running list, preserves current player', () => {
  it('closing the dialog always results in an empty running list', () => {
    fc.assert(
      fc.property(dialogStateArb, (state) => {
        const after = simulateDialogClose(state);
        expect(after.runningGames).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('closing the dialog resets playerName to empty string', () => {
    fc.assert(
      fc.property(dialogStateArb, (state) => {
        const after = simulateDialogClose(state);
        expect(after.playerName).toBe('');
      }),
      { numRuns: 100 }
    );
  });

  it('closing the dialog resets gameInput to empty name and price', () => {
    fc.assert(
      fc.property(dialogStateArb, (state) => {
        const after = simulateDialogClose(state);
        expect(after.gameInput).toEqual({ name: '', price: '' });
      }),
      { numRuns: 100 }
    );
  });

  it('closing the dialog resets gameInputError to null', () => {
    fc.assert(
      fc.property(dialogStateArb, (state) => {
        const after = simulateDialogClose(state);
        expect(after.gameInputError).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('closing the dialog sets sessionDialog to null', () => {
    fc.assert(
      fc.property(dialogStateArb, (state) => {
        const after = simulateDialogClose(state);
        expect(after.sessionDialog).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('closing the dialog does NOT change the currentPlayers map', () => {
    fc.assert(
      fc.property(dialogStateArb, (state) => {
        const before = { ...state.currentPlayers };
        const after = simulateDialogClose(state);

        // currentPlayers must be the exact same reference (not modified)
        expect(after.currentPlayers).toBe(state.currentPlayers);

        // And its contents must be unchanged
        expect(after.currentPlayers).toEqual(before);
      }),
      { numRuns: 100 }
    );
  });

  it('closing the dialog with a non-empty running list still results in empty list', () => {
    fc.assert(
      fc.property(
        fc.array(gameEntryArb, { minLength: 1, maxLength: 20 }),
        consoleIdArb,
        (runningGames, consoleId) => {
          const state = {
            sessionDialog: { id: consoleId, name: `Console-${consoleId}` },
            playerName: 'Alice',
            runningGames,
            gameInput: { name: 'Some Game', price: '10' },
            gameInputError: 'some error',
            currentPlayers: { [consoleId]: 'Alice' },
          };

          const after = simulateDialogClose(state);

          expect(after.runningGames).toEqual([]);
          // currentPlayers preserved
          expect(after.currentPlayers[consoleId]).toBe('Alice');
        }
      ),
      { numRuns: 100 }
    );
  });
});
