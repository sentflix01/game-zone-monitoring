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
  auth: {},
}));

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
  signInWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  isSignInWithEmailLink: vi.fn().mockReturnValue(false),
  signInWithEmailLink: vi.fn(),
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

          // Should redirect to dashboard, not show login form
          expect(getByTestId('dashboard')).toBeTruthy();
          expect(queryByTestId('login-form')).toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────
describe('Login page unit tests', () => {
  it('renders email input and send link button when unauthenticated', () => {
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

    expect(getByPlaceholderText('auth.login.emailPlaceholder')).toBeTruthy();
    expect(getByText('auth.otp.sendButton')).toBeTruthy();
    expect(getByText('auth.login.googleButton')).toBeTruthy();
  });

  it('shows offline message when navigator.onLine is false', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
      user: null,
      role: null,
    });

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const { getByText } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(getByText('auth.offline.message')).toBeTruthy();

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
});
