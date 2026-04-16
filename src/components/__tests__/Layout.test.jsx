// Feature: auth-and-roles, Property 10: Navigation items rendered match the user's role

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import * as fc from 'fast-check';
import { MemoryRouter } from 'react-router-dom';

// Mock AuthContext to control auth state
vi.mock('@/lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock I18nContext
vi.mock('@/i18n/I18nContext', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

// Mock child components that might cause issues
vi.mock('../InstallPWA', () => ({ default: () => null }));
vi.mock('../LanguageToggle', () => ({ default: () => null }));

// Mock react-router-dom — keep MemoryRouter/Link but mock useLocation
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useLocation: () => ({ pathname: '/' }),
    Outlet: () => null,
  };
});

import { useAuth } from '@/lib/AuthContext';
import Layout from '../Layout';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 10: Navigation items rendered match the user's role
// Validates: Requirements 8.1, 8.2
// ─────────────────────────────────────────────────────────────────────────────
describe("Property 10: Navigation items rendered match the user's role", () => {
  it('admin sees 8 nav items, user sees 6 nav items', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant('admin'), fc.constant('user')),
        (role) => {
          useAuth.mockReturnValue({ role, logout: vi.fn() });

          const { container, unmount } = render(
            <MemoryRouter>
              <Layout />
            </MemoryRouter>
          );

          const sidebar = container.querySelector('aside');
          const navLinks = sidebar ? sidebar.querySelectorAll('a[href]') : [];

          if (role === 'admin') {
            expect(navLinks.length).toBe(8);
          } else {
            expect(navLinks.length).toBe(6);
            const hrefs = Array.from(navLinks).map(a => a.getAttribute('href'));
            expect(hrefs).not.toContain('/expenses');
            expect(hrefs).not.toContain('/analytics');
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
describe('Layout nav filtering unit tests', () => {
  it('admin sees all 8 nav items including expenses and analytics', () => {
    useAuth.mockReturnValue({ role: 'admin', logout: vi.fn() });

    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    const sidebar = container.querySelector('aside');
    const links = sidebar.querySelectorAll('a[href]');
    const hrefs = Array.from(links).map(a => a.getAttribute('href'));

    expect(links.length).toBe(8);
    expect(hrefs).toContain('/expenses');
    expect(hrefs).toContain('/analytics');
  });

  it('user sees 6 nav items without expenses and analytics', () => {
    useAuth.mockReturnValue({ role: 'user', logout: vi.fn() });

    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    const sidebar = container.querySelector('aside');
    const links = sidebar.querySelectorAll('a[href]');
    const hrefs = Array.from(links).map(a => a.getAttribute('href'));

    expect(links.length).toBe(6);
    expect(hrefs).not.toContain('/expenses');
    expect(hrefs).not.toContain('/analytics');
  });

  it('renders logout button in header', () => {
    useAuth.mockReturnValue({ role: 'user', logout: vi.fn() });

    const { getByText } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    expect(getByText('auth.logout')).toBeTruthy();
  });

  it('calls logout when logout button is clicked', () => {
    const mockLogout = vi.fn();
    useAuth.mockReturnValue({ role: 'admin', logout: mockLogout });

    const { getByText } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    getByText('auth.logout').closest('button').click();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
