// Feature: auth-and-roles, Property 8: Admin-only UI elements hidden from regular users

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import * as fc from 'fast-check';

// Mock AuthContext to control auth state
vi.mock('../../lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../lib/AuthContext';
import RoleGuard from '../RoleGuard';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 8: Admin-only UI elements are hidden from regular users
// Validates: Requirements 6.3, 6.4, 6.5, 6.6
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 8: Admin-only UI elements hidden from regular users', () => {
  it('shows admin content only when role is admin, hides it for user', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant('admin'), fc.constant('user')),
        (role) => {
          useAuth.mockReturnValue({ role });

          const { queryByTestId, unmount } = render(
            <RoleGuard role="admin">
              <div data-testid="admin-only">Admin Only Content</div>
            </RoleGuard>
          );

          if (role === 'user') {
            expect(queryByTestId('admin-only')).toBeNull();
          } else {
            expect(queryByTestId('admin-only')).toBeTruthy();
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
describe('RoleGuard unit tests', () => {
  it('renders children when role matches', () => {
    useAuth.mockReturnValue({ role: 'admin' });

    const { getByTestId } = render(
      <RoleGuard role="admin">
        <div data-testid="content">Secret</div>
      </RoleGuard>
    );

    expect(getByTestId('content')).toBeTruthy();
  });

  it('renders null by default when role does not match and no fallback', () => {
    useAuth.mockReturnValue({ role: 'user' });

    const { container } = render(
      <RoleGuard role="admin">
        <div data-testid="content">Secret</div>
      </RoleGuard>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders fallback prop when role does not match', () => {
    useAuth.mockReturnValue({ role: 'user' });

    const { getByTestId, queryByTestId } = render(
      <RoleGuard role="admin" fallback={<div data-testid="fallback">No Access</div>}>
        <div data-testid="content">Secret</div>
      </RoleGuard>
    );

    expect(getByTestId('fallback')).toBeTruthy();
    expect(queryByTestId('content')).toBeNull();
  });

  it('renders children for user role when guard requires user', () => {
    useAuth.mockReturnValue({ role: 'user' });

    const { getByTestId } = render(
      <RoleGuard role="user">
        <div data-testid="user-content">User Content</div>
      </RoleGuard>
    );

    expect(getByTestId('user-content')).toBeTruthy();
  });
});
