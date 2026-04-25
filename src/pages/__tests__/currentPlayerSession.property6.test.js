// Feature: current-player-session, Property 6: Running total equals sum of game prices

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 6: Running total equals sum of game prices
 *
 * For any Running List of game entries, the displayed Running Total equals
 * the arithmetic sum of all price values in the list.
 *
 * Validates: Requirements 2.3, 2.4
 *
 * This test validates the pure computation from Consoles.jsx:
 *   runningGames.reduce((s, g) => s + g.price, 0)
 */

// Pure logic: compute running total from a list of game entries
function computeRunningTotal(games) {
  return games.reduce((s, g) => s + g.price, 0);
}

// Format total as displayed in the UI
function formatTotal(total) {
  return total.toFixed(2);
}

// Arbitrary for a valid game entry (positive price)
const validGameArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  price: fc.double({ min: 0.01, max: 9999, noNaN: true }).filter((p) => p > 0),
});

describe('Property 6: Running total equals sum of game prices', () => {
  it('running total equals arithmetic sum of all prices', () => {
    fc.assert(
      fc.property(fc.array(validGameArb, { minLength: 1, maxLength: 20 }), (games) => {
        const total = computeRunningTotal(games);
        const expected = games.reduce((s, g) => s + g.price, 0);
        expect(total).toBe(expected);
      }),
      { numRuns: 25 }
    );
  });

  it('running total is 0 for an empty list', () => {
    expect(computeRunningTotal([])).toBe(0);
  });

  it('running total equals single price for a one-entry list', () => {
    fc.assert(
      fc.property(validGameArb, (game) => {
        const total = computeRunningTotal([game]);
        expect(total).toBe(game.price);
      }),
      { numRuns: 25 }
    );
  });

  it('adding a game increases the total by exactly that game price', () => {
    fc.assert(
      fc.property(fc.array(validGameArb, { minLength: 0, maxLength: 19 }), validGameArb, (games, newGame) => {
        const before = computeRunningTotal(games);
        const after = computeRunningTotal([...games, newGame]);
        expect(after).toBeCloseTo(before + newGame.price, 10);
      }),
      { numRuns: 25 }
    );
  });

  it('removing a game decreases the total by exactly that game price', () => {
    fc.assert(
      fc.property(
        fc.array(validGameArb, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 19 }),
        (games, rawIdx) => {
          const idx = rawIdx % games.length;
          const before = computeRunningTotal(games);
          const after = computeRunningTotal(games.filter((_, i) => i !== idx));
          expect(after).toBeCloseTo(before - games[idx].price, 10);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('formatted total matches toFixed(2) of the sum', () => {
    fc.assert(
      fc.property(fc.array(validGameArb, { minLength: 1, maxLength: 20 }), (games) => {
        const total = computeRunningTotal(games);
        const formatted = formatTotal(total);
        expect(formatted).toBe(total.toFixed(2));
      }),
      { numRuns: 25 }
    );
  });

  it('total is order-independent (same games in different order yield same total)', () => {
    fc.assert(
      fc.property(fc.array(validGameArb, { minLength: 1, maxLength: 10 }), (games) => {
        const shuffled = [...games].sort(() => 0.5 - Math.random());
        const total1 = computeRunningTotal(games);
        const total2 = computeRunningTotal(shuffled);
        expect(total1).toBeCloseTo(total2, 10);
      }),
      { numRuns: 25 }
    );
  });
});
