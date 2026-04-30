// Feature: auth-and-roles, Property 2: Authenticated users are redirected away from Login

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
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
  firebaseReady: true,
  missingFirebaseEnvKeys: [],
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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import * as firebaseRuntime from '@/lib/firebase';

beforeEach(() => {
  vi.clearAllMocks();
  firebaseRuntime.firebaseReady = true;
  firebaseRuntime.missingFirebaseEnvKeys = [];
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
  it('renders identifier input and sign-in button when unauthenticated', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
      user: null,
      role: null,
    });

    const { getByPlaceholderText, getByRole } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(getByPlaceholderText('Email, Username, or Phone')).toBeTruthy();
    expect(getByRole('button', { name: 'Sign In' })).toBeTruthy();
  });

  it('shows no error banner on clean load', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
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

    // No error banner should be visible on initial render
    expect(container.querySelector('[class*="bg-red-500"]')).toBeNull();
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

  it('shows firebase config error and disables auth submit when unconfigured', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
      user: null,
      role: null,
    });
    firebaseRuntime.firebaseReady = false;
    firebaseRuntime.missingFirebaseEnvKeys = ['VITE_FIREBASE_API_KEY'];

    const { getByText, getByRole } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(getByText('Authentication is not configured for this deployment. Missing: VITE_FIREBASE_API_KEY.')).toBeTruthy();
    expect(getByRole('button', { name: 'Sign In' }).disabled).toBe(true);
  });

  it('shows specific message when Firebase error lacks err.code', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
      user: null,
      role: null,
    });
    createUserWithEmailAndPassword.mockRejectedValueOnce({
      message: 'Firebase: Error (auth/configuration-not-found).',
    });

    const { getByRole, getByPlaceholderText, findByText } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(getByRole('button', { name: 'Create account' }));
    fireEvent.change(getByPlaceholderText('you@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(getByPlaceholderText('Password'), { target: { value: '123456' } });
    fireEvent.change(getByPlaceholderText('Confirm password'), { target: { value: '123456' } });
    fireEvent.click(getByRole('button', { name: 'Create Account' }));

    await findByText('Firebase authentication configuration is missing. Enable Email/Password sign-in in Firebase Console.');
    await waitFor(() => expect(createUserWithEmailAndPassword).toHaveBeenCalledTimes(1));
  });

  it('maps recaptcha config runtime error to configuration message', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
      user: null,
      role: null,
    });
    createUserWithEmailAndPassword.mockRejectedValueOnce({
      message: 'TypeError: authInstance._canInitEmulator is not a function at _getRecaptchaConfig (setRecaptchaConfig is not a function)',
    });

    const { getByRole, getByPlaceholderText, findByText } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(getByRole('button', { name: 'Create account' }));
    fireEvent.change(getByPlaceholderText('you@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(getByPlaceholderText('Password'), { target: { value: '123456' } });
    fireEvent.change(getByPlaceholderText('Confirm password'), { target: { value: '123456' } });
    fireEvent.click(getByRole('button', { name: 'Create Account' }));

    await findByText('Firebase authentication configuration is missing. Enable Email/Password sign-in in Firebase Console.');
  });
});
