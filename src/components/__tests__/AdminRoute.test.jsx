// Feature: auth-and-roles, Property 7: Admin-only routes redirect regular users

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import * as fc from 'fast-check';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock AuthContext to control auth state
vi.mock('../../lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock i18n context
vi.mock('@/i18n/I18nContext', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

import { useAuth } from '../../lib/AuthContext';
import { toast } from 'sonner';
import AdminRoute from '../AdminRoute';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 7: Admin-only routes redirect regular users
// Validates: Requirements 6.1, 6.2
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 7: Admin-only routes redirect regular users', () => {
  it('redirects user role to / with toast, renders content for admin', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/analytics', '/expenses'),
        fc.oneof(fc.constant('owner'), fc.constant('monitor')),
        (path, role) => {
          useAuth.mockReturnValue({
            isAuthenticated: true,
            isLoadingAuth: false,
            role,
          });

          const { getByTestId, queryByTestId, unmount } = render(
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route element={<AdminRoute />}>
                  <Route path="*" element={<div data-testid="admin-content">Admin Content</div>} />
                </Route>
                <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
              </Routes>
            </MemoryRouter>
          );

          if (role === 'monitor') {
            // Should redirect to dashboard and fire toast
            expect(getByTestId('dashboard')).toBeTruthy();
            expect(queryByTestId('admin-content')).toBeNull();
            expect(toast.error).toHaveBeenCalledWith('auth.error.accessDenied');
          } else {
            // owner: should render protected content
            expect(getByTestId('admin-content')).toBeTruthy();
            expect(queryByTestId('dashboard')).toBeNull();
            expect(toast.error).not.toHaveBeenCalled();
          }

          unmount();
          vi.clearAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────
describe('AdminRoute unit tests', () => {
  it('renders loading spinner while isLoadingAuth is true', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoadingAuth: true, role: null });

    const { container, queryByTestId } = render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="*" element={<div data-testid="admin-content">Admin Content</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(queryByTestId('admin-content')).toBeNull();
    expect(queryByTestId('login-page')).toBeNull();
    expect(queryByTestId('dashboard')).toBeNull();
    expect(container.querySelector('[aria-label="Loading"]')).toBeTruthy();
  });

  it('redirects to /login when not authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoadingAuth: false, role: null });

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="*" element={<div data-testid="admin-content">Admin Content</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(getByTestId('login-page')).toBeTruthy();
  });

  it('redirects monitor role to / and fires toast.error', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isLoadingAuth: false, role: 'monitor' });

    const { getByTestId, queryByTestId } = render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="*" element={<div data-testid="admin-content">Admin Content</div>} />
          </Route>
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(getByTestId('dashboard')).toBeTruthy();
    expect(queryByTestId('admin-content')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('auth.error.accessDenied');
  });

  it('renders outlet for owner role', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isLoadingAuth: false, role: 'owner' });

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="*" element={<div data-testid="admin-content">Admin Content</div>} />
          </Route>
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(getByTestId('admin-content')).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
