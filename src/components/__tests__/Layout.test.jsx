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

describe("Property 10: Navigation items rendered match the user's role", () => {
  it('owner sees 9 nav items, monitor sees 6 nav items', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant('owner'), fc.constant('monitor')),
        (role) => {
          useAuth.mockReturnValue({ role, logout: vi.fn() });

          const { container, unmount } = render(
            <MemoryRouter>
              <Layout />
            </MemoryRouter>
          );

          const sidebar = container.querySelector('aside');
          const navLinks = sidebar ? sidebar.querySelectorAll('a[href]') : [];

          if (role === 'owner') {
            expect(navLinks.length).toBe(9);
          } else {
            expect(navLinks.length).toBe(6);
            const hrefs = Array.from(navLinks).map(a => a.getAttribute('href'));
            expect(hrefs).not.toContain('/expenses');
            expect(hrefs).not.toContain('/analytics');
            expect(hrefs).not.toContain('/monitors');
          }

          unmount();
          vi.clearAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

describe('Layout nav filtering unit tests', () => {
  it('owner sees all 9 nav items including expenses, analytics, and monitors', () => {
    useAuth.mockReturnValue({ role: 'owner', logout: vi.fn() });

    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    const sidebar = container.querySelector('aside');
    const links = sidebar.querySelectorAll('a[href]');
    const hrefs = Array.from(links).map(a => a.getAttribute('href'));

    expect(links.length).toBe(9);
    expect(hrefs).toContain('/expenses');
    expect(hrefs).toContain('/analytics');
    expect(hrefs).toContain('/monitors');
  });

  it('monitor sees 6 nav items without owner-only pages', () => {
    useAuth.mockReturnValue({ role: 'monitor', logout: vi.fn() });

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
    expect(hrefs).not.toContain('/monitors');
  });

  it('renders logout button in header', () => {
    useAuth.mockReturnValue({ role: 'monitor', logout: vi.fn() });

    const { getByText } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    expect(getByText('auth.logout')).toBeTruthy();
  });

  it('calls logout when logout button is clicked', () => {
    const mockLogout = vi.fn();
    useAuth.mockReturnValue({ role: 'owner', logout: mockLogout });

    const { getByText } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    getByText('auth.logout').closest('button').click();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
