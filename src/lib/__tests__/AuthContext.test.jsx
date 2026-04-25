import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import * as fc from 'fast-check';

// Mock ./firebase before importing AuthContext
vi.mock('../firebase', () => ({
  auth: {
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
  },
  db: {}, // Mock db object
}));

// Mock firestoreClient
vi.mock('@/api/firestoreClient', () => ({
  firestoreClient: {
    getMonitorOwner: vi.fn(),
    ownerExists: vi.fn().mockResolvedValue(true),
    createOwner: vi.fn(),
  }
}));

let authStateCallback = null;
const mockSignOut = vi.fn(() => Promise.resolve());
const mockOnAuthStateChanged = vi.fn((authInstance, callback) => {
  authStateCallback = callback;
  return () => { authStateCallback = null; };
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
  signOut: (...args) => mockSignOut(...args),
}));

import { AuthProvider, useAuth } from '../AuthContext';
import { firestoreClient } from '@/api/firestoreClient';

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
  mockSignOut.mockClear();
  mockOnAuthStateChanged.mockClear();
  firestoreClient.getMonitorOwner.mockClear();
  authStateCallback = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Property 3: Logout produces clean unauthenticated state', () => {
  it('after logout, user/role are null and isAuthenticated is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          uid: fc.string({ minLength: 1 }),
          role: fc.constantFrom('owner', 'monitor'),
        }),
        async ({ uid, role }) => {
          mockSignOut.mockResolvedValue(undefined);
          if (role === 'monitor') {
            firestoreClient.getMonitorOwner.mockResolvedValue('some-owner-id');
          } else {
            firestoreClient.getMonitorOwner.mockResolvedValue(null);
          }

          let capturedCtx = null;
          const { unmount } = renderWithAuth((ctx) => { capturedCtx = ctx; });

          // Provide a mock Firebase user with getIdTokenResult (no monitor claims)
          const mockUser = {
            uid,
            email: `${uid}@test.com`,
            getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
          };

          await act(async () => {
            authStateCallback?.(mockUser);
          });

          // Wait for resolveUser to finish
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(capturedCtx.isAuthenticated).toBe(true);
          expect(capturedCtx.user).not.toBeNull();

          await act(async () => {
            await capturedCtx.logout();
          });

          expect(capturedCtx.user).toBeNull();
          expect(capturedCtx.role).toBeNull();
          expect(capturedCtx.isAuthenticated).toBe(false);

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Property 4: Auth resolution maps owners and monitors correctly', () => {
  it('assigns owner role and ownerId=uid when getMonitorOwner returns null', async () => {
    firestoreClient.getMonitorOwner.mockResolvedValue(null);
    let capturedCtx = null;
    const { unmount } = renderWithAuth((ctx) => { capturedCtx = ctx; });

    const mockUser = {
      uid: 'owner-uid',
      email: 'owner@test.com',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    };

    await act(async () => {
      authStateCallback?.(mockUser);
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(capturedCtx.role).toBe('owner');
    expect(capturedCtx.ownerId).toBe('owner-uid');
    
    unmount();
  });

  it('assigns monitor role and ownerId=parent when getMonitorOwner returns data', async () => {
    firestoreClient.getMonitorOwner.mockResolvedValue('parent-owner-uid');
    let capturedCtx = null;
    const { unmount } = renderWithAuth((ctx) => { capturedCtx = ctx; });

    const mockUser = {
      uid: 'monitor-uid',
      email: 'monitor@test.com',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    };

    await act(async () => {
      authStateCallback?.(mockUser);
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(capturedCtx.role).toBe('monitor');
    expect(capturedCtx.ownerId).toBe('parent-owner-uid');
    
    unmount();
  });
});
