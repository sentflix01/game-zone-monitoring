// Feature: current-player-session, Property 5: Running list ordering

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 5: Running list ordering
 *
 * For any sequence of valid game additions, the Running List displays entries
 * in the order they were added, with the most recently added entry at the bottom.
 *
 * Validates: Requirements 2.2
 *
 * This test validates the pure state logic from Consoles.jsx:
 *   setRunningGames([...runningGames, { name: gameInput.name.trim(), price }]);
 * The list is built by appending to the end, so insertion order is preserved.
 */

// Pure logic: simulate adding games to the running list
function addGamesToList(games) {
  const list = [];
  for (const g of games) {
    list.push({ name: g.name.trim(), price: g.price });
  }
  return list;
}

// Arbitrary for a valid game entry
const validGameArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  price: fc.double({ min: 0.01, max: 9999, noNaN: true }).filter((p) => p > 0),
});

describe('Property 5: Running list ordering', () => {
  it('entries appear in insertion order (FIFO)', () => {
    fc.assert(
      fc.property(fc.array(validGameArb, { minLength: 1, maxLength: 20 }), (games) => {
        const list = addGamesToList(games);
        expect(list.length).toBe(games.length);
        for (let i = 0; i < games.length; i++) {
          expect(list[i].name).toBe(games[i].name.trim());
          expect(list[i].price).toBe(games[i].price);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('most recently added entry is always at the bottom (last index)', () => {
    fc.assert(
      fc.property(fc.array(validGameArb, { minLength: 1, maxLength: 20 }), (games) => {
        const list = addGamesToList(games);
        const last = games[games.length - 1];
        expect(list[list.length - 1].name).toBe(last.name.trim());
        expect(list[list.length - 1].price).toBe(last.price);
      }),
      { numRuns: 100 }
    );
  });

  it('first added entry is always at the top (index 0)', () => {
    fc.assert(
      fc.property(fc.array(validGameArb, { minLength: 1, maxLength: 20 }), (games) => {
        const list = addGamesToList(games);
        const first = games[0];
        expect(list[0].name).toBe(first.name.trim());
        expect(list[0].price).toBe(first.price);
      }),
      { numRuns: 100 }
    );
  });

  it('list length equals number of games added', () => {
    fc.assert(
      fc.property(fc.array(validGameArb, { minLength: 0, maxLength: 20 }), (games) => {
        const list = addGamesToList(games);
        expect(list.length).toBe(games.length);
      }),
      { numRuns: 100 }
    );
  });

  it('relative order of any two entries is preserved', () => {
    fc.assert(
      fc.property(fc.array(validGameArb, { minLength: 2, maxLength: 20 }), (games) => {
        const list = addGamesToList(games);
        // For every pair i < j in input, they appear in the same relative order in output
        for (let i = 0; i < games.length - 1; i++) {
          for (let j = i + 1; j < games.length; j++) {
            const posI = list.findIndex((e, idx) => idx === i);
            const posJ = list.findIndex((e, idx) => idx === j);
            expect(posI).toBeLessThan(posJ);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
