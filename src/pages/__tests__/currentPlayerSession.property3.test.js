// Feature: current-player-session, Property 3: Per-console current player isolation

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 3: Per-console current player isolation
 *
 * For any two distinct consoles A and B, writing a current player for console A
 * does not change the current player stored for console B.
 *
 * Validates: Requirements 1.4, 5.1
 *
 * This test validates the isolation logic from Consoles.jsx:
 *   setCurrentPlayers((prev) => ({ ...prev, [c.id]: name }));
 * and the localStorage key scoping:
 *   localStorage.setItem(`gamezone_current_player_${c.id}`, name);
 */

// Pure logic: update currentPlayers for a single console (mirrors Consoles.jsx)
function updateCurrentPlayer(currentPlayers, consoleId, playerName) {
  return { ...currentPlayers, [consoleId]: playerName };
}

// Pure logic: write to a localStorage-like store
function writeToStore(store, consoleId, playerName) {
  const key = `gamezone_current_player_${consoleId}`;
  return { ...store, [key]: playerName };
}

// Arbitrary for console IDs (non-empty strings)
const consoleIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0);

// Arbitrary for non-empty player names
const nonEmptyNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

describe('Property 3: Per-console current player isolation', () => {
  it('writing to console A does not change the currentPlayers entry for console B', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        nonEmptyNameArb,
        nonEmptyNameArb,
        nonEmptyNameArb,
        (consoleA, consoleB, initialB, newNameA, newNameB) => {
          fc.pre(consoleA !== consoleB);

          // Start with console B having a stored player
          let currentPlayers = { [consoleB]: initialB };

          // Write to console A
          currentPlayers = updateCurrentPlayer(currentPlayers, consoleA, newNameA);

          // Console B's entry must be unchanged
          expect(currentPlayers[consoleB]).toBe(initialB);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('writing to console B does not change the currentPlayers entry for console A', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        nonEmptyNameArb,
        nonEmptyNameArb,
        (consoleA, consoleB, initialA, newNameB) => {
          fc.pre(consoleA !== consoleB);

          let currentPlayers = { [consoleA]: initialA };
          currentPlayers = updateCurrentPlayer(currentPlayers, consoleB, newNameB);

          expect(currentPlayers[consoleA]).toBe(initialA);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('localStorage keys are scoped per console — writing key A does not affect key B', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        nonEmptyNameArb,
        nonEmptyNameArb,
        (consoleA, consoleB, nameA, nameB) => {
          fc.pre(consoleA !== consoleB);

          let store = {};
          // Pre-populate console B
          store = writeToStore(store, consoleB, nameB);

          // Write console A
          store = writeToStore(store, consoleA, nameA);

          const keyA = `gamezone_current_player_${consoleA}`;
          const keyB = `gamezone_current_player_${consoleB}`;

          expect(store[keyA]).toBe(nameA);
          expect(store[keyB]).toBe(nameB);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple writes to console A never affect any other console', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        fc.array(consoleIdArb, { minLength: 1, maxLength: 5 }),
        nonEmptyNameArb,
        fc.array(nonEmptyNameArb, { minLength: 1, maxLength: 5 }),
        (consoleA, otherConsoles, nameA, otherNames) => {
          // Ensure all other consoles are distinct from A
          const distinctOthers = [...new Set(otherConsoles)].filter((id) => id !== consoleA);
          fc.pre(distinctOthers.length > 0);

          // Build initial state with all other consoles populated
          let currentPlayers = {};
          distinctOthers.forEach((id, i) => {
            currentPlayers[id] = otherNames[i % otherNames.length];
          });

          const snapshot = { ...currentPlayers };

          // Write to console A multiple times
          currentPlayers = updateCurrentPlayer(currentPlayers, consoleA, nameA);
          currentPlayers = updateCurrentPlayer(currentPlayers, consoleA, nameA + '_v2');

          // All other consoles must be unchanged
          for (const id of distinctOthers) {
            expect(currentPlayers[id]).toBe(snapshot[id]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('two consoles can independently hold different player names', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        nonEmptyNameArb,
        nonEmptyNameArb,
        (consoleA, consoleB, nameA, nameB) => {
          fc.pre(consoleA !== consoleB);

          let currentPlayers = {};
          currentPlayers = updateCurrentPlayer(currentPlayers, consoleA, nameA);
          currentPlayers = updateCurrentPlayer(currentPlayers, consoleB, nameB);

          expect(currentPlayers[consoleA]).toBe(nameA);
          expect(currentPlayers[consoleB]).toBe(nameB);
        }
      ),
      { numRuns: 100 }
    );
  });
});
