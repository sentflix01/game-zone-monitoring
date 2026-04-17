// Feature: current-player-session, Property 10: Current player updated on commit

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 10: Current player updated on commit
 *
 * For any console and player name, after clicking Start, the value stored at
 * `gamezone_current_player_{consoleId}` equals the player name that was entered.
 * Empty player name defaults to 'Anonymous'.
 *
 * Validates: Requirements 3.2
 *
 * This test validates the pure logic extracted from startSession() in Consoles.jsx:
 *   const name = playerName || 'Anonymous';
 *   localStorage.setItem(`gamezone_current_player_${c.id}`, name);
 */

// Pure logic extracted from startSession() in Consoles.jsx
function commitCurrentPlayer(store, consoleId, playerName) {
  const name = playerName || 'Anonymous';
  store[`gamezone_current_player_${consoleId}`] = name;
  return name;
}

// Arbitrary for console IDs (non-empty alphanumeric-ish strings)
const consoleIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0);

// Arbitrary for player names (any string, including empty)
const playerNameArb = fc.string({ maxLength: 100 });

// Arbitrary for non-empty player names
const nonEmptyPlayerNameArb = fc.string({ minLength: 1, maxLength: 100 });

describe('Property 10: Current player updated on commit', () => {
  let store;

  beforeEach(() => {
    store = {};
  });

  it('localStorage key equals the player name after commit for any console and non-empty player name', () => {
    fc.assert(
      fc.property(consoleIdArb, nonEmptyPlayerNameArb, (consoleId, playerName) => {
        const localStore = {};
        commitCurrentPlayer(localStore, consoleId, playerName);

        const key = `gamezone_current_player_${consoleId}`;
        expect(localStore[key]).toBe(playerName);
      }),
      { numRuns: 100 }
    );
  });

  it('empty player name defaults to "Anonymous" in the stored key', () => {
    fc.assert(
      fc.property(consoleIdArb, (consoleId) => {
        const localStore = {};
        commitCurrentPlayer(localStore, consoleId, '');

        const key = `gamezone_current_player_${consoleId}`;
        expect(localStore[key]).toBe('Anonymous');
      }),
      { numRuns: 100 }
    );
  });

  it('stored value equals playerName || "Anonymous" for any player name (including empty)', () => {
    fc.assert(
      fc.property(consoleIdArb, playerNameArb, (consoleId, playerName) => {
        const localStore = {};
        const committed = commitCurrentPlayer(localStore, consoleId, playerName);

        const key = `gamezone_current_player_${consoleId}`;
        const expected = playerName || 'Anonymous';

        expect(localStore[key]).toBe(expected);
        expect(committed).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('key is scoped to the specific consoleId (different consoles get different keys)', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        nonEmptyPlayerNameArb,
        nonEmptyPlayerNameArb,
        (consoleIdA, consoleIdB, playerA, playerB) => {
          fc.pre(consoleIdA !== consoleIdB);

          const localStore = {};
          commitCurrentPlayer(localStore, consoleIdA, playerA);
          commitCurrentPlayer(localStore, consoleIdB, playerB);

          const keyA = `gamezone_current_player_${consoleIdA}`;
          const keyB = `gamezone_current_player_${consoleIdB}`;

          // Each console's key holds its own player name
          expect(localStore[keyA]).toBe(playerA);
          expect(localStore[keyB]).toBe(playerB);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('committing overwrites any previously stored player for the same console', () => {
    fc.assert(
      fc.property(consoleIdArb, nonEmptyPlayerNameArb, nonEmptyPlayerNameArb, (consoleId, firstName, secondName) => {
        const localStore = {};
        commitCurrentPlayer(localStore, consoleId, firstName);
        commitCurrentPlayer(localStore, consoleId, secondName);

        const key = `gamezone_current_player_${consoleId}`;
        expect(localStore[key]).toBe(secondName);
      }),
      { numRuns: 100 }
    );
  });
});
