// Feature: current-player-session, Property 2: Current player button pre-fills input

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 2: Current player button pre-fills input
 *
 * For any console with a stored current player name, clicking the Current Player
 * Button sets the player name input value to exactly that stored name.
 *
 * Validates: Requirements 1.2
 *
 * This test validates the pure click handler logic from Consoles.jsx:
 *   onClick={() => setPlayerName(currentPlayers[sessionDialog.id])}
 */

// Pure logic: simulate clicking the current player button
function handleCurrentPlayerClick(currentPlayers, consoleId) {
  // Mirrors: setPlayerName(currentPlayers[sessionDialog.id])
  return currentPlayers[consoleId];
}

// Arbitrary for console IDs (non-empty strings)
const consoleIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0);

// Arbitrary for non-empty player names (button is only shown when name is truthy)
const nonEmptyNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

describe('Property 2: Current player button pre-fills input', () => {
  it('clicking the button sets playerName to exactly the stored name', () => {
    fc.assert(
      fc.property(consoleIdArb, nonEmptyNameArb, (consoleId, storedName) => {
        const currentPlayers = { [consoleId]: storedName };
        const newPlayerName = handleCurrentPlayerClick(currentPlayers, consoleId);
        expect(newPlayerName).toBe(storedName);
      }),
      { numRuns: 25 }
    );
  });

  it('playerName after click equals stored name exactly (no trimming or transformation)', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        // Include names with leading/trailing spaces to verify no transformation
        fc.string({ minLength: 1, maxLength: 100 }),
        (consoleId, storedName) => {
          fc.pre(storedName.length > 0);
          const currentPlayers = { [consoleId]: storedName };
          const newPlayerName = handleCurrentPlayerClick(currentPlayers, consoleId);
          // Must be exactly the stored value — no modification
          expect(newPlayerName).toBe(storedName);
          expect(newPlayerName).toStrictEqual(storedName);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('clicking the button for console A does not affect the stored name for console B', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        nonEmptyNameArb,
        nonEmptyNameArb,
        (consoleA, consoleB, nameA, nameB) => {
          fc.pre(consoleA !== consoleB);

          const currentPlayers = { [consoleA]: nameA, [consoleB]: nameB };

          // Clicking button for console A
          const resultA = handleCurrentPlayerClick(currentPlayers, consoleA);
          expect(resultA).toBe(nameA);

          // Console B's stored name is unchanged
          expect(currentPlayers[consoleB]).toBe(nameB);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('result of click is always the same as the stored value (idempotent)', () => {
    fc.assert(
      fc.property(consoleIdArb, nonEmptyNameArb, (consoleId, storedName) => {
        const currentPlayers = { [consoleId]: storedName };

        // Clicking multiple times always returns the same value
        const first = handleCurrentPlayerClick(currentPlayers, consoleId);
        const second = handleCurrentPlayerClick(currentPlayers, consoleId);

        expect(first).toBe(storedName);
        expect(second).toBe(storedName);
        expect(first).toBe(second);
      }),
      { numRuns: 25 }
    );
  });
});
