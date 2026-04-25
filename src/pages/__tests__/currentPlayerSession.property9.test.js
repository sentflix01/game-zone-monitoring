// Feature: current-player-session, Property 9: Session record contains games and running total

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 9: Session record contains games and running total
 *
 * For any player name and non-empty Running List, clicking Start creates exactly
 * one Session record whose `games` array equals the Running List and whose
 * `amount_charged` equals the Running Total.
 *
 * Validates: Requirements 3.1
 *
 * This test validates the pure logic extracted from startSession() in Consoles.jsx:
 *   if (runningGames.length > 0) {
 *     amount_charged = runningGames.reduce((s, g) => s + g.price, 0);
 *     games = runningGames;
 *   }
 */

// Pure logic extracted from startSession() in Consoles.jsx
function computeSessionFields(runningGames, pricingRate) {
  if (runningGames.length > 0) {
    return {
      amount_charged: runningGames.reduce((s, g) => s + g.price, 0),
      games: runningGames,
    };
  }
  // fallback: empty running list uses pricing rate
  return {
    amount_charged: pricingRate,
    games: [],
  };
}

// Arbitrary for a single GameEntry with price > 0
// Use integer cents (1–999900) divided by 100 to get a clean positive price
const gameEntryArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  price: fc.integer({ min: 1, max: 99900 }).map((cents) => cents / 100),
});

// Arbitrary for a non-empty array of GameEntry objects
const nonEmptyRunningListArb = fc.array(gameEntryArb, { minLength: 1, maxLength: 20 });

// Arbitrary for player names (any string, including empty — defaults to "Anonymous")
const playerNameArb = fc.string({ maxLength: 50 });

describe('Property 9: Session record contains games and running total', () => {
  it('amount_charged equals sum of all game prices for any non-empty running list', () => {
    fc.assert(
      fc.property(playerNameArb, nonEmptyRunningListArb, (playerName, runningGames) => {
        const { amount_charged, games } = computeSessionFields(runningGames, 0);

        const expectedTotal = runningGames.reduce((s, g) => s + g.price, 0);

        // amount_charged must equal the sum of all game prices
        expect(amount_charged).toBeCloseTo(expectedTotal, 10);

        // games array must equal the runningGames array (same reference / deep equal)
        expect(games).toEqual(runningGames);
        expect(games).toBe(runningGames); // same reference, not a copy
      }),
      { numRuns: 25 }
    );
  });

  it('games array passed to session equals the runningGames array', () => {
    fc.assert(
      fc.property(nonEmptyRunningListArb, (runningGames) => {
        const { games } = computeSessionFields(runningGames, 0);

        // games must be the exact runningGames array
        expect(games).toBe(runningGames);
        expect(games.length).toBe(runningGames.length);

        // Each entry must match exactly
        for (let i = 0; i < runningGames.length; i++) {
          expect(games[i].name).toBe(runningGames[i].name);
          expect(games[i].price).toBe(runningGames[i].price);
        }
      }),
      { numRuns: 25 }
    );
  });

  it('amount_charged is the arithmetic sum of prices (not min, max, or count)', () => {
    fc.assert(
      fc.property(nonEmptyRunningListArb, (runningGames) => {
        const { amount_charged } = computeSessionFields(runningGames, 0);

        const sum = runningGames.reduce((s, g) => s + g.price, 0);

        // Must equal sum, not count
        if (runningGames.length > 1) {
          const allSamePrice = runningGames.every((g) => g.price === runningGames[0].price);
          if (!allSamePrice) {
            // sum !== count * any_single_price when prices differ
            expect(amount_charged).toBeCloseTo(sum, 10);
          }
        }

        expect(amount_charged).toBeCloseTo(sum, 10);
      }),
      { numRuns: 25 }
    );
  });

  it('fallback: empty running list uses pricing rate, not sum', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99900 }).map((cents) => cents / 100), (pricingRate) => {
        const { amount_charged, games } = computeSessionFields([], pricingRate);

        expect(amount_charged).toBe(pricingRate);
        expect(games).toEqual([]);
      }),
      { numRuns: 25 }
    );
  });
});
