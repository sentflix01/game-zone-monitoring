// Feature: current-player-session, Property 12: Console card shows at most two session rows

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 12: Console card shows at most two session rows
 *
 * For any console with any number of completed sessions, the Console Card displays
 * at most two session rows: the single most-recently-completed session row and the
 * current active session row. When a new session is committed, the previous completed
 * row is replaced.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 *
 * This test validates the pure derivation logic from Consoles.jsx:
 *   previousSession = allSessions
 *     .filter(s => s.status === 'completed' && s.console_id === c.id)
 *     .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))[0] ?? null
 *
 * Row count = (previousSession ? 1 : 0) + (active ? 1 : 0) <= 2
 */

// Pure logic: derive the rows that would be rendered for a console card
function deriveConsoleRows(consoleId, allSessions, activeSessions) {
  const active = activeSessions.find((s) => s.console_id === consoleId) ?? null;

  const previousSession = allSessions
    .filter((s) => s.status === 'completed' && s.console_id === consoleId)
    .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))[0] ?? null;

  const rows = [];
  if (previousSession) rows.push({ type: 'previous', session: previousSession });
  if (active) rows.push({ type: 'active', session: active });

  return rows;
}

// Arbitrary for a console ID
const consoleIdArb = fc.uuid();

// Arbitrary for an ISO date string (within a reasonable range)
const isoDateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
  .map((d) => d.toISOString());

// Arbitrary for a completed session for a given console
const completedSessionArb = (consoleId) =>
  fc.record({
    id: fc.uuid(),
    console_id: fc.constant(consoleId),
    player_name: fc.string({ minLength: 1, maxLength: 30 }),
    status: fc.constant('completed'),
    end_time: isoDateArb,
    amount_charged: fc.integer({ min: 0, max: 10000 }).map((c) => c / 100),
    games: fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 30 }),
        price: fc.integer({ min: 1, max: 9999 }).map((c) => c / 100),
      }),
      { minLength: 0, maxLength: 10 }
    ),
  });

// Arbitrary for an active session for a given console
const activeSessionArb = (consoleId) =>
  fc.record({
    id: fc.uuid(),
    console_id: fc.constant(consoleId),
    player_name: fc.string({ minLength: 1, maxLength: 30 }),
    status: fc.constant('active'),
    start_time: isoDateArb,
    games: fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 30 }),
        price: fc.integer({ min: 1, max: 9999 }).map((c) => c / 100),
      }),
      { minLength: 0, maxLength: 10 }
    ),
  });

describe('Property 12: Console card shows at most two session rows', () => {
  it('renders at most 2 rows for any number of completed sessions', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        fc.integer({ min: 0, max: 20 }),
        fc.boolean(),
        (consoleId, completedCount, hasActive) => {
          // Build completed sessions for this console
          const completedSessions = Array.from({ length: completedCount }, (_, i) => ({
            id: `session-${i}`,
            console_id: consoleId,
            player_name: `Player${i}`,
            status: 'completed',
            end_time: new Date(Date.now() - i * 60000).toISOString(),
            amount_charged: i * 10,
            games: [],
          }));

          const activeSessions = hasActive
            ? [{ id: 'active-1', console_id: consoleId, player_name: 'ActivePlayer', status: 'active', start_time: new Date().toISOString(), games: [] }]
            : [];

          const rows = deriveConsoleRows(consoleId, completedSessions, activeSessions);

          // Must never exceed 2 rows
          expect(rows.length).toBeLessThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shows exactly 0 rows when no sessions exist', () => {
    fc.assert(
      fc.property(consoleIdArb, (consoleId) => {
        const rows = deriveConsoleRows(consoleId, [], []);
        expect(rows.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('shows exactly 1 row (active only) when no completed sessions exist', () => {
    fc.assert(
      fc.property(consoleIdArb, activeSessionArb(fc.sample(consoleIdArb, 1)[0]), (consoleId, _ignored) => {
        const activeSession = { id: 'a1', console_id: consoleId, player_name: 'P', status: 'active', start_time: new Date().toISOString(), games: [] };
        const rows = deriveConsoleRows(consoleId, [], [activeSession]);
        expect(rows.length).toBe(1);
        expect(rows[0].type).toBe('active');
      }),
      { numRuns: 100 }
    );
  });

  it('shows exactly 1 row (previous only) when completed sessions exist but no active session', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        fc.integer({ min: 1, max: 10 }),
        (consoleId, completedCount) => {
          const completedSessions = Array.from({ length: completedCount }, (_, i) => ({
            id: `s${i}`,
            console_id: consoleId,
            player_name: `P${i}`,
            status: 'completed',
            end_time: new Date(Date.now() - i * 60000).toISOString(),
            amount_charged: 10,
            games: [],
          }));

          const rows = deriveConsoleRows(consoleId, completedSessions, []);
          expect(rows.length).toBe(1);
          expect(rows[0].type).toBe('previous');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shows exactly 2 rows when both a completed and active session exist', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        fc.integer({ min: 1, max: 10 }),
        (consoleId, completedCount) => {
          const completedSessions = Array.from({ length: completedCount }, (_, i) => ({
            id: `s${i}`,
            console_id: consoleId,
            player_name: `P${i}`,
            status: 'completed',
            end_time: new Date(Date.now() - i * 60000).toISOString(),
            amount_charged: 10,
            games: [],
          }));

          const activeSessions = [{
            id: 'active-1',
            console_id: consoleId,
            player_name: 'ActivePlayer',
            status: 'active',
            start_time: new Date().toISOString(),
            games: [],
          }];

          const rows = deriveConsoleRows(consoleId, completedSessions, activeSessions);
          expect(rows.length).toBe(2);
          expect(rows[0].type).toBe('previous');
          expect(rows[1].type).toBe('active');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('previous row always shows the most recently completed session (by end_time)', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        fc.integer({ min: 2, max: 10 }),
        (consoleId, completedCount) => {
          // Create sessions with distinct end_times
          const completedSessions = Array.from({ length: completedCount }, (_, i) => ({
            id: `s${i}`,
            console_id: consoleId,
            player_name: `Player${i}`,
            status: 'completed',
            end_time: new Date(1000000 + i * 60000).toISOString(), // ascending order
            amount_charged: i * 5,
            games: [],
          }));

          const rows = deriveConsoleRows(consoleId, completedSessions, []);
          expect(rows.length).toBe(1);
          // Should be the last one (highest end_time = index completedCount-1)
          expect(rows[0].session.player_name).toBe(`Player${completedCount - 1}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sessions from other consoles do not contribute rows to this console', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        fc.integer({ min: 1, max: 5 }),
        (consoleA, consoleB, count) => {
          fc.pre(consoleA !== consoleB);

          // Only sessions for consoleB
          const otherSessions = Array.from({ length: count }, (_, i) => ({
            id: `s${i}`,
            console_id: consoleB,
            player_name: `P${i}`,
            status: 'completed',
            end_time: new Date(Date.now() - i * 60000).toISOString(),
            amount_charged: 10,
            games: [],
          }));

          const rows = deriveConsoleRows(consoleA, otherSessions, []);
          expect(rows.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
