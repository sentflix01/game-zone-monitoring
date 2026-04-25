// Feature: current-player-session, Property 15: Console non-interference

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 15: Console non-interference
 *
 * For any two distinct consoles A and B, mutating one console's state leaves
 * the other's state unchanged.
 *
 * Validates: Requirements 5.2, 5.3
 *
 * This test validates the isolation logic in Consoles.jsx:
 * - allSessions filtered by console_id means sessions for console A don't appear for console B
 * - currentPlayers map is keyed by console_id, so writing A's key doesn't affect B's key
 * - activeSessions filtered by console_id means active session for A doesn't appear for B
 */

// Pure logic: derive the state visible to a specific console
function deriveConsoleState(consoleId, allSessions, activeSessions, currentPlayers) {
  const active = activeSessions.find((s) => s.console_id === consoleId) ?? null;

  const previousSession = allSessions
    .filter((s) => s.status === 'completed' && s.console_id === consoleId)
    .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))[0] ?? null;

  const currentPlayer = currentPlayers[consoleId] ?? null;

  return { active, previousSession, currentPlayer };
}

// Pure logic: simulate committing a session for a console (updates allSessions + currentPlayers)
function commitSession(allSessions, activeSessions, currentPlayers, consoleId, playerName, games) {
  const newSession = {
    id: `new-${consoleId}-${Date.now()}`,
    console_id: consoleId,
    player_name: playerName,
    status: 'active',
    start_time: new Date().toISOString(),
    games,
    amount_charged: games.reduce((s, g) => s + g.price, 0),
  };

  const newActiveSessions = [...activeSessions, newSession];
  const newCurrentPlayers = { ...currentPlayers, [consoleId]: playerName };

  return { allSessions, activeSessions: newActiveSessions, currentPlayers: newCurrentPlayers };
}

// Pure logic: simulate ending a session for a console
function endSession(allSessions, activeSessions, consoleId) {
  const active = activeSessions.find((s) => s.console_id === consoleId);
  if (!active) return { allSessions, activeSessions };

  const completed = { ...active, status: 'completed', end_time: new Date().toISOString() };
  const newAllSessions = [...allSessions, completed];
  const newActiveSessions = activeSessions.filter((s) => s.console_id !== consoleId);

  return { allSessions: newAllSessions, activeSessions: newActiveSessions };
}

// Arbitraries
const consoleIdArb = fc.uuid();

const gameEntryArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }),
  price: fc.integer({ min: 1, max: 9999 }).map((c) => c / 100),
});

const playerNameArb = fc.string({ minLength: 1, maxLength: 30 });

describe('Property 15: Console non-interference', () => {
  it('starting a session on console A does not create an active session for console B', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        playerNameArb,
        fc.array(gameEntryArb, { minLength: 0, maxLength: 5 }),
        (consoleA, consoleB, playerName, games) => {
          fc.pre(consoleA !== consoleB);

          const initialState = { allSessions: [], activeSessions: [], currentPlayers: {} };

          // Capture B's state before
          const beforeB = deriveConsoleState(consoleB, initialState.allSessions, initialState.activeSessions, initialState.currentPlayers);

          // Start a session on A
          const afterState = commitSession(
            initialState.allSessions,
            initialState.activeSessions,
            initialState.currentPlayers,
            consoleA,
            playerName,
            games
          );

          // B's state must be unchanged
          const afterB = deriveConsoleState(consoleB, afterState.allSessions, afterState.activeSessions, afterState.currentPlayers);

          expect(afterB.active).toEqual(beforeB.active);
          expect(afterB.previousSession).toEqual(beforeB.previousSession);
          expect(afterB.currentPlayer).toEqual(beforeB.currentPlayer);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('ending a session on console A does not affect console B active session', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        playerNameArb,
        playerNameArb,
        (consoleA, consoleB, playerA, playerB) => {
          fc.pre(consoleA !== consoleB);

          // Both consoles have active sessions
          const activeSessions = [
            { id: 'a1', console_id: consoleA, player_name: playerA, status: 'active', start_time: new Date().toISOString(), games: [] },
            { id: 'b1', console_id: consoleB, player_name: playerB, status: 'active', start_time: new Date().toISOString(), games: [] },
          ];
          const allSessions = [];
          const currentPlayers = { [consoleA]: playerA, [consoleB]: playerB };

          // Capture B's state before ending A
          const beforeB = deriveConsoleState(consoleB, allSessions, activeSessions, currentPlayers);

          // End session on A
          const { allSessions: newAll, activeSessions: newActive } = endSession(allSessions, activeSessions, consoleA);

          // B's active session must be unchanged
          const afterB = deriveConsoleState(consoleB, newAll, newActive, currentPlayers);

          expect(afterB.active).toEqual(beforeB.active);
          expect(afterB.currentPlayer).toEqual(beforeB.currentPlayer);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('currentPlayers for console B is unaffected when console A commits a session', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        playerNameArb,
        playerNameArb,
        playerNameArb,
        (consoleA, consoleB, existingPlayerB, newPlayerA, _unused) => {
          fc.pre(consoleA !== consoleB);

          const currentPlayers = { [consoleB]: existingPlayerB };

          const afterState = commitSession([], [], currentPlayers, consoleA, newPlayerA, []);

          // B's current player must be unchanged
          expect(afterState.currentPlayers[consoleB]).toBe(existingPlayerB);
          // A's current player must be set
          expect(afterState.currentPlayers[consoleA]).toBe(newPlayerA);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('completed sessions for console A do not appear in console B previousSession', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        fc.integer({ min: 1, max: 5 }),
        (consoleA, consoleB, count) => {
          fc.pre(consoleA !== consoleB);

          // Create completed sessions only for console A
          const allSessions = Array.from({ length: count }, (_, i) => ({
            id: `s${i}`,
            console_id: consoleA,
            player_name: `PlayerA${i}`,
            status: 'completed',
            end_time: new Date(Date.now() - i * 60000).toISOString(),
            amount_charged: 10,
            games: [],
          }));

          const stateB = deriveConsoleState(consoleB, allSessions, [], {});

          // Console B should have no previous session
          expect(stateB.previousSession).toBeNull();
        }
      ),
      { numRuns: 25 }
    );
  });

  it('mutating state for console A multiple times never affects console B', () => {
    fc.assert(
      fc.property(
        consoleIdArb,
        consoleIdArb,
        playerNameArb,
        playerNameArb,
        fc.array(gameEntryArb, { minLength: 0, maxLength: 5 }),
        (consoleA, consoleB, playerA, playerB, games) => {
          fc.pre(consoleA !== consoleB);

          // Set up initial state with B having a session
          let state = {
            allSessions: [],
            activeSessions: [
              { id: 'b-active', console_id: consoleB, player_name: playerB, status: 'active', start_time: new Date().toISOString(), games: [] },
            ],
            currentPlayers: { [consoleB]: playerB },
          };

          // Capture B's initial state
          const initialB = deriveConsoleState(consoleB, state.allSessions, state.activeSessions, state.currentPlayers);

          // Start session on A
          state = commitSession(state.allSessions, state.activeSessions, state.currentPlayers, consoleA, playerA, games);

          // End session on A
          const ended = endSession(state.allSessions, state.activeSessions, consoleA);
          state = { ...state, allSessions: ended.allSessions, activeSessions: ended.activeSessions };

          // Start another session on A
          state = commitSession(state.allSessions, state.activeSessions, state.currentPlayers, consoleA, playerA + '2', []);

          // B's state must still match initial
          const finalB = deriveConsoleState(consoleB, state.allSessions, state.activeSessions, state.currentPlayers);

          expect(finalB.active?.console_id).toBe(initialB.active?.console_id);
          expect(finalB.active?.player_name).toBe(initialB.active?.player_name);
          expect(finalB.currentPlayer).toBe(initialB.currentPlayer);
          expect(finalB.previousSession).toEqual(initialB.previousSession);
        }
      ),
      { numRuns: 25 }
    );
  });
});
