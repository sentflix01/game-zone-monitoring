// Feature: auth-and-roles, Property 1: Unauthenticated users are always redirected to Login

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import * as fc from 'fast-check';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock AuthContext to control auth state
vi.mock('../../lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../lib/AuthContext';
import ProtectedRoute from '../ProtectedRoute';

// Helper: render ProtectedRoute at a given path with a mock auth state
function renderProtectedRoute(path, authState) {
  useAuth.mockReturnValue(authState);

  const navigatedTo = { current: null };

  // Capture where Navigate sends us by rendering a sentinel at /login
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="*" element={<div data-testid="protected-content">Protected</div>} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>
  );

  return navigatedTo;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 1: Unauthenticated users are always redirected to Login
// Validates: Requirements 1.1
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 1: Unauthenticated users are always redirected to Login', () => {
  it('renders the login page for any route path when unauthenticated', () => {
    fc.assert(
      fc.property(
        // Generate valid URL path strings (non-empty, starting with /)
        fc.string({ minLength: 1, maxLength: 50 }).map((s) => {
          // Ensure it's a valid path segment (no special chars that break MemoryRouter)
          const clean = s.replace(/[^a-zA-Z0-9-_]/g, 'x');
          return '/' + (clean || 'page');
        }),
        (path) => {
          useAuth.mockReturnValue({
            isAuthenticated: false,
            isLoadingAuth: false,
          });

          const { getByTestId, unmount } = render(
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route path="*" element={<div data-testid="protected-content">Protected</div>} />
                </Route>
                <Route path="/login" element={<div data-testid="login-page">Login</div>} />
              </Routes>
            </MemoryRouter>
          );

          // Should show login page, not protected content
          expect(getByTestId('login-page')).toBeTruthy();
          expect(() => getByTestId('protected-content')).toThrow();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: loading state and authenticated state
// ─────────────────────────────────────────────────────────────────────────────
describe('ProtectedRoute unit tests', () => {
  it('renders a loading indicator while isLoadingAuth is true', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoadingAuth: true });

    const { container, queryByTestId } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="*" element={<div data-testid="protected-content">Protected</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(queryByTestId('protected-content')).toBeNull();
    expect(queryByTestId('login-page')).toBeNull();
    // Loading spinner container should be present
    expect(container.querySelector('[aria-label="Loading"]')).toBeTruthy();
  });

  it('renders the outlet when authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isLoadingAuth: false });

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="*" element={<div data-testid="protected-content">Protected</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(getByTestId('protected-content')).toBeTruthy();
  });

  it('redirects to /login when not authenticated and not loading', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoadingAuth: false });

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="*" element={<div data-testid="protected-content">Protected</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(getByTestId('login-page')).toBeTruthy();
  });
});
