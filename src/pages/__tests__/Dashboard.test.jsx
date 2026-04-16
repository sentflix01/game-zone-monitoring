// Feature: auth-and-roles, Property 9: Dashboard financial content visibility matches role

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import * as fc from 'fast-check';
import { MemoryRouter } from 'react-router-dom';

// Mock AuthContext to control auth state
vi.mock('@/lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// We need a module-level ref for the RoleGuard mock to access useAuth
let _useAuth = null;

// Mock RoleGuard — conditionally renders based on role prop and mocked useAuth
vi.mock('@/components/RoleGuard', () => ({
  default: ({ role, fallback = null, children }) => {
    if (!_useAuth) return fallback;
    const { role: currentRole } = _useAuth();
    return currentRole === role ? children : fallback;
  },
}));

// Mock storageAdapter to return empty arrays
vi.mock('@/api/storageAdapter', () => ({
  storageAdapter: {
    entities: {
      Console: { list: vi.fn().mockResolvedValue([]) },
      Session: { list: vi.fn().mockResolvedValue([]) },
      Expense: { list: vi.fn().mockResolvedValue([]) },
    },
  },
}));

// Mock I18nContext
vi.mock('@/i18n/I18nContext', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

// Mock react-router-dom — keep MemoryRouter, render Link as anchor
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children),
  };
});

// Mock recharts to avoid rendering issues
vi.mock('recharts', () => ({
  BarChart: ({ children }) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }) => React.createElement('div', null, children),
}));

// Mock date-fns subDays
vi.mock('date-fns', () => ({
  subDays: (date, days) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000),
}));

import { useAuth } from '@/lib/AuthContext';
import Dashboard from '../Dashboard';

// Wire up the RoleGuard mock to use the mocked useAuth
_useAuth = useAuth;

// Stub window.matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

beforeEach(() => {
  vi.clearAllMocks();
});

function renderDashboard(role) {
  useAuth.mockReturnValue({ role });
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 9: Dashboard financial content visibility matches role
// Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 9: Dashboard financial content visibility matches role', () => {
  it('shows/hides financial content based on role across 100 runs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.constant('admin'), fc.constant('user')),
        async (role) => {
          const { container, unmount } = renderDashboard(role);

          // Wait for async data loading
          await new Promise((resolve) => setTimeout(resolve, 0));

          if (role === 'user') {
            expect(container.querySelector('[data-tour="pnl-cards"]')).toBeNull();
            expect(container.textContent).not.toContain('dashboard.stat.todayEarnings');
          } else {
            expect(container.querySelector('[data-tour="pnl-cards"]')).not.toBeNull();
            expect(container.textContent).toContain('dashboard.stat.todayEarnings');
          }

          // Always present regardless of role
          expect(container.textContent).toContain('dashboard.stat.available');
          expect(container.textContent).toContain('dashboard.stat.inUse');
          expect(container.textContent).toContain('dashboard.stat.activeSessions');

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
describe('Dashboard financial content unit tests', () => {
  it('user: P&L cards absent, todayEarnings absent', async () => {
    const { container } = renderDashboard('user');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('[data-tour="pnl-cards"]')).toBeNull();
    expect(container.textContent).not.toContain('dashboard.stat.todayEarnings');
  });

  it('admin: P&L cards present, todayEarnings present', async () => {
    const { container } = renderDashboard('admin');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('[data-tour="pnl-cards"]')).not.toBeNull();
    expect(container.textContent).toContain('dashboard.stat.todayEarnings');
  });

  it('user: available, inUse, activeSessions stats always present', async () => {
    const { container } = renderDashboard('user');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toContain('dashboard.stat.available');
    expect(container.textContent).toContain('dashboard.stat.inUse');
    expect(container.textContent).toContain('dashboard.stat.activeSessions');
  });

  it('admin: available, inUse, activeSessions stats always present', async () => {
    const { container } = renderDashboard('admin');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toContain('dashboard.stat.available');
    expect(container.textContent).toContain('dashboard.stat.inUse');
    expect(container.textContent).toContain('dashboard.stat.activeSessions');
  });

  it('user: manage expenses and full analytics links absent', async () => {
    const { container } = renderDashboard('user');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).not.toContain('dashboard.pnl.manageExpenses');
    expect(container.textContent).not.toContain('dashboard.pnl.fullAnalytics');
  });

  it('admin: manage expenses and full analytics links present', async () => {
    const { container } = renderDashboard('admin');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toContain('dashboard.pnl.manageExpenses');
    expect(container.textContent).toContain('dashboard.pnl.fullAnalytics');
  });
});
