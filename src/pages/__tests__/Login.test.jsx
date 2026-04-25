// Feature: auth-and-roles, Property 2: Authenticated users are redirected away from Login

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import * as fc from 'fast-check';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock AuthContext to control auth state
vi.mock('@/lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock firebase
vi.mock('@/lib/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
    currentUser: null,
  },
}));

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: Object.assign(
    vi.fn(function MockGoogleAuthProvider() {
      this.setCustomParameters = vi.fn();
    }),
    {
      credential: vi.fn().mockReturnValue({ providerId: 'google.com' }),
    }
  ),
  signInWithPopup: vi.fn().mockResolvedValue({ user: { uid: 'test-uid' } }),
  signInWithRedirect: vi.fn().mockResolvedValue(undefined),
  getRedirectResult: vi.fn().mockResolvedValue(null),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock i18n
vi.mock('@/i18n/I18nContext', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { useAuth } from '@/lib/AuthContext';
import Login from '../Login';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 2: Authenticated users are redirected away from Login
// Validates: Requirements 1.2
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 2: Authenticated users are redirected away from Login', () => {
  it('redirects any authenticated user away from /login to /', () => {
    fc.assert(
      fc.property(
        fc.record({
          uid: fc.string({ minLength: 1 }),
          role: fc.constantFrom('admin', 'user'),
        }),
        ({ uid, role }) => {
          useAuth.mockReturnValue({
            isAuthenticated: true,
            isLoadingAuth: false,
            user: { uid },
            role,
          });

          const { getByTestId, queryByTestId, unmount } = render(
            <MemoryRouter initialEntries={['/login']}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
              </Routes>
            </MemoryRouter>
          );

          expect(getByTestId('dashboard')).toBeTruthy();
          expect(queryByTestId('login-form')).toBeNull();

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────
describe('Login page unit tests', () => {
  it('renders email input and Google button when unauthenticated', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
      user: null,
      role: null,
    });

    const { getByPlaceholderText, getByText } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByText('Continue with Google')).toBeTruthy();
  });
  it('shows loading spinner when auth is loading', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: true,
      user: null,
      role: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
