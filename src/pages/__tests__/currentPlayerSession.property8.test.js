// Feature: current-player-session, Property 8: Invalid game entry rejected

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 8: Invalid game entry rejected
 *
 * For any attempted game addition where the game name is empty (or
 * whitespace-only) or the price is non-positive (≤ 0), the Running List
 * remains unchanged and a validation error is displayed.
 *
 * Validates: Requirements 2.6
 *
 * This test validates the validation logic from Consoles.jsx:
 *   if (!gameInput.name.trim()) { setGameInputError("Game name is required"); return; }
 *   const price = parseFloat(gameInput.price);
 *   if (!gameInput.price || isNaN(price) || price <= 0) { setGameInputError("Price must be greater than 0"); return; }
 *   setRunningGames([...runningGames, { name: gameInput.name.trim(), price }]);
 */

/**
 * Pure logic mirroring the "Add" button handler in Consoles.jsx.
 * Returns { runningGames, gameInputError } after attempting to add a game.
 */
function tryAddGame(runningGames, gameInput) {
  if (!gameInput.name.trim()) {
    return { runningGames, gameInputError: 'Game name is required' };
  }
  const price = parseFloat(gameInput.price);
  if (!gameInput.price || isNaN(price) || price <= 0) {
    return { runningGames, gameInputError: 'Price must be greater than 0' };
  }
  return {
    runningGames: [...runningGames, { name: gameInput.name.trim(), price }],
    gameInputError: null,
  };
}

// Arbitrary for existing running games list
const gameEntryArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(999), noNaN: true }),
});
const runningGamesArb = fc.array(gameEntryArb, { minLength: 0, maxLength: 10 });

// Arbitrary for whitespace-only / empty strings
const blankStringArb = fc.oneof(
  fc.constant(''),
  fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 20 }).map((c) => c.join(''))
);

// Arbitrary for non-positive prices (as strings)
const nonPositivePriceArb = fc.oneof(
  fc.constant('0'),
  fc.constant(''),
  fc.constant('-1'),
  fc.float({ max: Math.fround(0), noNaN: true }).map(String),
  fc.constant('abc'),
  fc.constant('NaN'),
);

// Arbitrary for valid game names
const validNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

// Arbitrary for valid positive prices (as strings)
const validPriceArb = fc.float({ min: Math.fround(0.01), max: Math.fround(9999), noNaN: true }).map(String);

describe('Property 8: Invalid game entry rejected', () => {
  it('empty game name is rejected — running list unchanged, error set', () => {
    fc.assert(
      fc.property(runningGamesArb, blankStringArb, validPriceArb, (games, blankName, price) => {
        const before = [...games];
        const result = tryAddGame(games, { name: blankName, price });

        expect(result.runningGames).toEqual(before);
        expect(result.gameInputError).toBe('Game name is required');
      }),
      { numRuns: 100 }
    );
  });

  it('non-positive price is rejected — running list unchanged, error set', () => {
    fc.assert(
      fc.property(runningGamesArb, validNameArb, nonPositivePriceArb, (games, name, badPrice) => {
        const before = [...games];
        const result = tryAddGame(games, { name, price: badPrice });

        expect(result.runningGames).toEqual(before);
        expect(result.gameInputError).toBe('Price must be greater than 0');
      }),
      { numRuns: 100 }
    );
  });

  it('empty name takes precedence over invalid price — name error shown', () => {
    fc.assert(
      fc.property(runningGamesArb, blankStringArb, nonPositivePriceArb, (games, blankName, badPrice) => {
        const before = [...games];
        const result = tryAddGame(games, { name: blankName, price: badPrice });

        expect(result.runningGames).toEqual(before);
        expect(result.gameInputError).toBe('Game name is required');
      }),
      { numRuns: 100 }
    );
  });

  it('valid name + valid positive price is accepted — entry appended, no error', () => {
    fc.assert(
      fc.property(runningGamesArb, validNameArb, validPriceArb, (games, name, priceStr) => {
        const before = [...games];
        const result = tryAddGame(games, { name, price: priceStr });

        expect(result.gameInputError).toBeNull();
        expect(result.runningGames.length).toBe(before.length + 1);
        const added = result.runningGames[result.runningGames.length - 1];
        expect(added.name).toBe(name.trim());
        expect(added.price).toBe(parseFloat(priceStr));
      }),
      { numRuns: 100 }
    );
  });

  it('invalid entry never mutates the original running games array', () => {
    fc.assert(
      fc.property(
        runningGamesArb,
        fc.oneof(
          fc.record({ name: blankStringArb, price: validPriceArb }),
          fc.record({ name: validNameArb, price: nonPositivePriceArb })
        ),
        (games, invalidInput) => {
          const snapshot = JSON.stringify(games);
          tryAddGame(games, invalidInput);
          // Original array must not be mutated
          expect(JSON.stringify(games)).toBe(snapshot);
        }
      ),
      { numRuns: 100 }
    );
  });
});
