import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useContext } from 'react';
import * as fc from 'fast-check';

// Mock ./firebase before importing AuthContext
vi.mock('../firebase', () => ({
  auth: {
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
  },
}));

// We'll set up the firebase/auth mock with controllable callbacks
let authStateCallback = null;
const mockSignOut = vi.fn(() => Promise.resolve());
const mockOnAuthStateChanged = vi.fn((authInstance, callback) => {
  authStateCallback = callback;
  // Return unsubscribe function
  return () => { authStateCallback = null; };
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
  signOut: (...args) => mockSignOut(...args),
}));

// Import after mocks are set up
import { AuthProvider, useAuth } from '../AuthContext';

const ROLE_KEY = 'gamezone_user_role';

// Helper component to capture context value
function AuthConsumer({ onValue }) {
  const ctx = useAuth();
  onValue(ctx);
  return null;
}

function renderWithAuth(onValue) {
  return render(
    <AuthProvider>
      <AuthConsumer onValue={onValue} />
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockSignOut.mockClear();
  mockOnAuthStateChanged.mockClear();
  authStateCallback = null;
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature: auth-and-roles, Property 3: Logout produces clean unauthenticated state
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 3: Logout produces clean unauthenticated state', () => {
  it('after logout, user/role are null, isAuthenticated is false, and storage key is cleared', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          uid: fc.string({ minLength: 1 }),
          role: fc.constantFrom('admin', 'user'),
        }),
        async ({ uid, role }) => {
          localStorage.clear();
          mockSignOut.mockResolvedValue(undefined);

          let capturedCtx = null;
          const { unmount } = renderWithAuth((ctx) => { capturedCtx = ctx; });

          // Simulate authenticated state
          await act(async () => {
            localStorage.setItem(ROLE_KEY, role);
            authStateCallback?.({ uid, email: `${uid}@test.com` });
          });

          expect(capturedCtx.isAuthenticated).toBe(true);
          expect(capturedCtx.user).not.toBeNull();

          // Call logout
          await act(async () => {
            await capturedCtx.logout();
          });

          expect(capturedCtx.user).toBeNull();
          expect(capturedCtx.role).toBeNull();
          expect(capturedCtx.isAuthenticated).toBe(false);
          expect(localStorage.getItem(ROLE_KEY)).toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature: auth-and-roles, Property 4: Role values are always valid
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 4: Role values are always valid', () => {
  it('setRole only stores "admin" or "user" in localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.constant('admin'), fc.constant('user')),
        async (validRole) => {
          localStorage.clear();

          let capturedCtx = null;
          const { unmount } = renderWithAuth((ctx) => { capturedCtx = ctx; });

          // Simulate authenticated state first
          await act(async () => {
            localStorage.setItem(ROLE_KEY, 'user');
            authStateCallback?.({ uid: 'test-uid', email: 'test@test.com' });
          });

          // Call setRole with a valid role
          await act(async () => {
            capturedCtx.setRole('test-uid', validRole);
          });

          const stored = localStorage.getItem(ROLE_KEY);
          expect(stored === 'admin' || stored === 'user').toBe(true);
          expect(stored).toBe(validRole);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature: auth-and-roles, Property 5: New users receive the `user` role by default
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 5: New users receive the user role by default', () => {
  it('first-time auth with no pre-existing role key assigns role === "user"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (uid) => {
          localStorage.clear();
          // Ensure no pre-existing role
          localStorage.removeItem(ROLE_KEY);

          let capturedCtx = null;
          const { unmount } = renderWithAuth((ctx) => { capturedCtx = ctx; });

          // Simulate first-time auth (no role in storage)
          await act(async () => {
            authStateCallback?.({ uid, email: `${uid}@test.com` });
          });

          expect(capturedCtx.role).toBe('user');
          expect(localStorage.getItem(ROLE_KEY)).toBe('user');

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature: auth-and-roles, Property 6: Role persistence round-trip
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 6: Role persistence round-trip', () => {
  it('setRole persists to localStorage and updates context role immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.constant('admin'), fc.constant('user')),
        async (assignedRole) => {
          localStorage.clear();

          let capturedCtx = null;
          const { unmount } = renderWithAuth((ctx) => { capturedCtx = ctx; });

          // Simulate authenticated state
          await act(async () => {
            localStorage.setItem(ROLE_KEY, 'user');
            authStateCallback?.({ uid: 'test-uid', email: 'test@test.com' });
          });

          // Assign the role
          await act(async () => {
            capturedCtx.setRole('test-uid', assignedRole);
          });

          // Both localStorage and context role must match the assigned value
          const storedRole = localStorage.getItem(ROLE_KEY);
          expect(storedRole).toBe(assignedRole);
          expect(capturedCtx.role).toBe(assignedRole);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
