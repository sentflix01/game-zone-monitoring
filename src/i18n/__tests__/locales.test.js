// Feature: auth-and-roles, Property 11: Auth translation keys present in all locales

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import en from '../locales/en';
import am from '../locales/am';

const authKeys = [
  'auth.login.title',
  'auth.login.subtitle',
  'auth.login.emailLabel',
  'auth.login.emailPlaceholder',
  'auth.login.googleButton',
  'auth.login.orDivider',
  'auth.login.backToLogin',
  'auth.otp.sendButton',
  'auth.otp.sentTitle',
  'auth.otp.sentBody',
  'auth.otp.confirmTitle',
  'auth.otp.confirmSubtitle',
  'auth.otp.confirmEmailLabel',
  'auth.otp.confirmButton',
  'auth.error.invalidEmail',
  'auth.error.googleCancelled',
  'auth.error.googleFailed',
  'auth.error.tooManyRequests',
  'auth.error.networkError',
  'auth.error.accessDenied',
  'auth.error.otpLinkInvalid',
  'auth.offline.message',
  'auth.logout',
  'auth.role.admin',
  'auth.role.user',
  'auth.settings.promoteTitle',
  'auth.settings.promoteLabel',
  'auth.settings.promoteButton',
  'auth.settings.currentRole',
];

// ─────────────────────────────────────────────────────────────────────────────
// Property 11: Auth translation keys present in all locales
// Validates: Requirements 10.2
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 11: Auth translation keys present in all locales', () => {
  it('every auth key is defined and non-empty in both en and am locales', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...authKeys),
        (key) => {
          expect(en[key]).toBeDefined();
          expect(typeof en[key]).toBe('string');
          expect(en[key].length).toBeGreaterThan(0);

          expect(am[key]).toBeDefined();
          expect(typeof am[key]).toBe('string');
          expect(am[key].length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit test: verify all keys explicitly
describe('Auth i18n keys unit tests', () => {
  it('all auth keys present in en locale', () => {
    for (const key of authKeys) {
      expect(en[key], `Missing en key: ${key}`).toBeDefined();
      expect(en[key].length, `Empty en key: ${key}`).toBeGreaterThan(0);
    }
  });

  it('all auth keys present in am locale', () => {
    for (const key of authKeys) {
      expect(am[key], `Missing am key: ${key}`).toBeDefined();
      expect(am[key].length, `Empty am key: ${key}`).toBeGreaterThan(0);
    }
  });
});
