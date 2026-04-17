// Feature: current-player-session, Property 4: Add Game form visibility

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 4: Add Game form visibility
 *
 * For any session dialog state, the Add Game input area is visible if and only
 * if the player name input is non-empty (after trimming whitespace).
 *
 * Validates: Requirements 2.1
 *
 * This test validates the pure visibility logic from Consoles.jsx:
 *   {playerName.trim() && (
 *     <div className="space-y-2">...</div>
 *   )}
 */

// Pure logic: should the Add Game form be visible?
function isAddGameFormVisible(playerName) {
  return Boolean(playerName.trim());
}

// Arbitrary for non-empty player names (after trim)
const nonEmptyNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

// Arbitrary for whitespace-only strings
const whitespaceOnlyArb = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(''));

describe('Property 4: Add Game form visibility', () => {
  it('form is visible when playerName has non-whitespace content', () => {
    fc.assert(
      fc.property(nonEmptyNameArb, (playerName) => {
        expect(isAddGameFormVisible(playerName)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('form is NOT visible when playerName is empty string', () => {
    expect(isAddGameFormVisible('')).toBe(false);
  });

  it('form is NOT visible when playerName is whitespace-only', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (playerName) => {
        expect(isAddGameFormVisible(playerName)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('form visibility matches playerName.trim() being non-empty for any string', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (playerName) => {
        const visible = isAddGameFormVisible(playerName);
        const hasContent = playerName.trim().length > 0;
        expect(visible).toBe(hasContent);
      }),
      { numRuns: 100 }
    );
  });

  it('leading/trailing whitespace does not make form visible if no real content', () => {
    fc.assert(
      fc.property(
        whitespaceOnlyArb,
        whitespaceOnlyArb,
        (leading, trailing) => {
          const playerName = leading + trailing;
          expect(isAddGameFormVisible(playerName)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('form becomes visible when any non-whitespace character is added to empty name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1 }).filter((c) => c.trim().length > 0),
        fc.string({ minLength: 0, maxLength: 50 }),
        (nonWsChar, rest) => {
          const playerName = nonWsChar + rest;
          expect(isAddGameFormVisible(playerName)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
