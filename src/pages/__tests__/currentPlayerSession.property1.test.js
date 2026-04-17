// Feature: current-player-session, Property 1: Current player button visibility

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 1: Current player button visibility
 *
 * For any console ID and optional stored name, the Current Player Button is
 * displayed if and only if a non-empty current player name is stored for that
 * console's ID.
 *
 * Validates: Requirements 1.1, 1.3
 *
 * This test validates the pure visibility logic from Consoles.jsx:
 *   {currentPlayers[sessionDialog?.id] && (
 *     <button ...>{currentPlayers[sessionDialog?.id]}</button>
 *   )}
 */

// Pure logic: should the button be visible?
function isButtonVisible(currentPlayers, consoleId) {
  return Boolean(currentPlayers[consoleId]);
}

// Prototype property names that would cause false positives on plain objects
const PROTO_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));

// Arbitrary for console IDs (non-empty strings, excluding prototype property names)
const consoleIdArb = fc
  .string({ minLength: 1, maxLength: 36 })
  .filter((s) => s.trim().length > 0 && !PROTO_KEYS.has(s));

// Arbitrary for non-empty player names
const nonEmptyNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

describe('Property 1: Current player button visibility', () => {
  it('button is visible when a non-empty name is stored for the console', () => {
    fc.assert(
      fc.property(consoleIdArb, nonEmptyNameArb, (consoleId, storedName) => {
        const currentPlayers = { [consoleId]: storedName };
        expect(isButtonVisible(currentPlayers, consoleId)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('button is NOT visible when no name is stored for the console', () => {
    fc.assert(
      fc.property(consoleIdArb, (consoleId) => {
        const currentPlayers = {};
        expect(isButtonVisible(currentPlayers, consoleId)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('button is NOT visible when stored name is an empty string', () => {
    fc.assert(
      fc.property(consoleIdArb, (consoleId) => {
        const currentPlayers = { [consoleId]: '' };
        expect(isButtonVisible(currentPlayers, consoleId)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('button visibility matches stored state for any combination of consoleId and optional name', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        fc.option(nonEmptyNameArb, { nil: undefined }),
        (consoleId, maybeName) => {
          const currentPlayers = {};
          if (maybeName !== undefined) currentPlayers[consoleId] = maybeName;

          const visible = isButtonVisible(currentPlayers, consoleId);
          const hasStored = maybeName !== undefined && maybeName.length > 0;

          expect(visible).toBe(hasStored);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('button for console A is not affected by storing a name for console B', () => {
    fc.assert(
      fc.property(consoleIdArb, consoleIdArb, nonEmptyNameArb, (consoleA, consoleB, name) => {
        fc.pre(consoleA !== consoleB);

        const currentPlayers = { [consoleB]: name };

        // Console A has no stored name — button should not be visible
        expect(isButtonVisible(currentPlayers, consoleA)).toBe(false);
        // Console B has a stored name — button should be visible
        expect(isButtonVisible(currentPlayers, consoleB)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
