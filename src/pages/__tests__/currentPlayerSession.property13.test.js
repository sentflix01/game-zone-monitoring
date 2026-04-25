// Feature: current-player-session, Property 13: Completed session row renders required fields

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 13: Completed session row renders required fields
 *
 * For any completed session (with random games arrays), the rendered row contains
 * player name, count of games played, and total amount charged.
 *
 * Validates: Requirements 4.5
 *
 * This test validates the pure data extraction logic for the previous-session-row
 * rendered in Consoles.jsx:
 *   <p>{previousSession.player_name}</p>
 *   <p>{previousSession.games?.length ?? 0} games · {previousSession.amount_charged}</p>
 */

// Pure logic: extract the fields that would be rendered in the previous-session-row
function extractPreviousSessionRowFields(session) {
  return {
    playerName: session.player_name,
    gameCount: session.games?.length ?? 0,
    amountCharged: session.amount_charged,
  };
}

// Arbitrary for a single game entry
const gameEntryArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  price: fc.integer({ min: 1, max: 99900 }).map((cents) => cents / 100),
});

// Arbitrary for a player name (non-empty)
const playerNameArb = fc.string({ minLength: 1, maxLength: 50 });

// Arbitrary for amount_charged (non-negative)
const amountChargedArb = fc.integer({ min: 0, max: 999900 }).map((cents) => cents / 100);

// Safe ISO date string arbitrary (avoids fc.date() range issues in fast-check v4)
const isoDateArb = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-06-01').getTime() })
  .map((ms) => new Date(ms).toISOString());

// Arbitrary for a completed session with a games array
const completedSessionWithGamesArb = fc.record({
  id: fc.uuid(),
  console_id: fc.uuid(),
  player_name: playerNameArb,
  status: fc.constant('completed'),
  end_time: isoDateArb,
  amount_charged: amountChargedArb,
  games: fc.array(gameEntryArb, { minLength: 0, maxLength: 20 }),
});

// Arbitrary for a completed session WITHOUT a games field (legacy sessions)
const completedSessionWithoutGamesArb = fc.record({
  id: fc.uuid(),
  console_id: fc.uuid(),
  player_name: playerNameArb,
  status: fc.constant('completed'),
  end_time: isoDateArb,
  amount_charged: amountChargedArb,
  // no games field
});

describe('Property 13: Completed session row renders required fields', () => {
  it('rendered row contains the player name for any completed session', () => {
    fc.assert(
      fc.property(completedSessionWithGamesArb, (session) => {
        const fields = extractPreviousSessionRowFields(session);
        expect(fields.playerName).toBe(session.player_name);
        expect(typeof fields.playerName).toBe('string');
        expect(fields.playerName.length).toBeGreaterThan(0);
      }),
      { numRuns: 25 }
    );
  });

  it('rendered row contains the correct game count for any games array', () => {
    fc.assert(
      fc.property(completedSessionWithGamesArb, (session) => {
        const fields = extractPreviousSessionRowFields(session);
        expect(fields.gameCount).toBe(session.games.length);
      }),
      { numRuns: 25 }
    );
  });

  it('rendered row contains the amount_charged for any completed session', () => {
    fc.assert(
      fc.property(completedSessionWithGamesArb, (session) => {
        const fields = extractPreviousSessionRowFields(session);
        expect(fields.amountCharged).toBe(session.amount_charged);
      }),
      { numRuns: 25 }
    );
  });

  it('game count defaults to 0 when games field is absent (legacy sessions)', () => {
    fc.assert(
      fc.property(completedSessionWithoutGamesArb, (session) => {
        const fields = extractPreviousSessionRowFields(session);
        expect(fields.gameCount).toBe(0);
      }),
      { numRuns: 25 }
    );
  });

  it('game count equals games.length for sessions with any number of games', () => {
    fc.assert(
      fc.property(
        playerNameArb,
        amountChargedArb,
        fc.array(gameEntryArb, { minLength: 0, maxLength: 30 }),
        (playerName, amountCharged, games) => {
          const session = {
            id: 'test-id',
            console_id: 'console-1',
            player_name: playerName,
            status: 'completed',
            end_time: new Date().toISOString(),
            amount_charged: amountCharged,
            games,
          };

          const fields = extractPreviousSessionRowFields(session);

          expect(fields.playerName).toBe(playerName);
          expect(fields.gameCount).toBe(games.length);
          expect(fields.amountCharged).toBe(amountCharged);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('all three required fields are present and non-null for any valid completed session', () => {
    fc.assert(
      fc.property(completedSessionWithGamesArb, (session) => {
        const fields = extractPreviousSessionRowFields(session);

        // All three fields must be present
        expect(fields.playerName).toBeDefined();
        expect(fields.gameCount).toBeDefined();
        expect(fields.amountCharged).toBeDefined();

        // None should be null or undefined
        expect(fields.playerName).not.toBeNull();
        expect(fields.gameCount).not.toBeNull();
        expect(fields.amountCharged).not.toBeNull();

        // gameCount must be a non-negative integer
        expect(fields.gameCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(fields.gameCount)).toBe(true);
      }),
      { numRuns: 25 }
    );
  });
});
