/**
 * Bug Condition Exploration Tests — Task 1
 *
 * These tests are written BEFORE any fix is applied.
 * Their purpose is to surface counterexamples that demonstrate each bug condition.
 *
 * EXPECTED OUTCOMES on unfixed code:
 *   1a — PWA Icon Format Mismatch: may PASS if PNG files exist in public/, FAIL if absent
 *   1b — Capacitor Config Sync Staleness: FAILS (launchShowDuration: 2000 vs expected 500)
 *   1c — Rollup External @capacitor/preferences: FAILS (dynamic import present in bundle)
 *   1d — GoogleAuth Native Asset Presence: FAILS (google-services.json absent)
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// 1a. PWA Icon Format Mismatch
// ---------------------------------------------------------------------------
describe('1a: PWA Icon Format Mismatch', () => {
  it('all icon src paths in manifest.webmanifest must resolve to existing files in dist/', () => {
    const manifestPath = path.resolve('dist/manifest.webmanifest');

    // dist/ must exist (run `npm run build` first)
    expect(fs.existsSync(manifestPath), 'dist/manifest.webmanifest must exist — run npm run build first').toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const icons: Array<{ src: string; sizes: string; type: string }> = manifest.icons ?? [];

    expect(icons.length, 'manifest must declare at least one icon').toBeGreaterThan(0);

    // Property: for ALL icon entries, the src file must exist in dist/
    fc.assert(
      fc.property(
        fc.constantFrom(...icons),
        (entry) => {
          const filePath = path.resolve('dist', entry.src);
          const exists = fs.existsSync(filePath);
          // Document counterexample when file is absent
          if (!exists) {
            console.error(`[1a counterexample] dist/${entry.src} does not exist`);
          }
          return exists;
        }
      ),
      { numRuns: icons.length }
    );
  });

  it('concrete case: dist/icon-192.png must exist', () => {
    expect(
      fs.existsSync(path.resolve('dist/icon-192.png')),
      'dist/icon-192.png absent — PWA manifest references a missing file'
    ).toBe(true);
  });

  it('concrete case: dist/icon-512.png must exist', () => {
    expect(
      fs.existsSync(path.resolve('dist/icon-512.png')),
      'dist/icon-512.png absent — PWA manifest references a missing file'
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 1b. Capacitor Config Sync Staleness
// ---------------------------------------------------------------------------
describe('1b: Capacitor Config Sync Staleness', () => {
  const nativeConfigPath = path.resolve(
    'android/app/src/main/assets/capacitor.config.json'
  );

  it('native capacitor.config.json must exist', () => {
    expect(
      fs.existsSync(nativeConfigPath),
      'android/app/src/main/assets/capacitor.config.json must exist'
    ).toBe(true);
  });

  it('SplashScreen.launchShowDuration must be 500 (matching capacitor.config.ts)', () => {
    expect(fs.existsSync(nativeConfigPath)).toBe(true);

    const nativeConfig = JSON.parse(fs.readFileSync(nativeConfigPath, 'utf-8'));
    const actual = nativeConfig?.plugins?.SplashScreen?.launchShowDuration;

    // Document the counterexample
    if (actual !== 500) {
      console.error(
        `[1b counterexample] { key: 'launchShowDuration', expected: 500, actual: ${actual} }`
      );
      console.error(
        '[1b] Stale native config detected — run `npx cap sync android` to fix'
      );
    }

    // Property: the synced native value must match the source-of-truth (500)
    expect(actual, `launchShowDuration should be 500 but got ${actual}`).toBe(500);
  });

  it('property: all shared SplashScreen keys must match between capacitor.config.ts and native JSON', () => {
    expect(fs.existsSync(nativeConfigPath)).toBe(true);

    const nativeConfig = JSON.parse(fs.readFileSync(nativeConfigPath, 'utf-8'));

    // Source-of-truth values from capacitor.config.ts
    const expectedSplashScreen: Record<string, unknown> = {
      launchShowDuration: 500,
      backgroundColor: '#0f172a',
      showSpinner: false,
    };

    const sharedKeys = Object.keys(expectedSplashScreen);

    fc.assert(
      fc.property(
        fc.constantFrom(...sharedKeys),
        (key) => {
          const expected = expectedSplashScreen[key];
          const actual = nativeConfig?.plugins?.SplashScreen?.[key];
          if (actual !== expected) {
            console.error(
              `[1b counterexample] { key: '${key}', expected: ${JSON.stringify(expected)}, actual: ${JSON.stringify(actual)} }`
            );
          }
          return actual === expected;
        }
      ),
      { numRuns: sharedKeys.length }
    );
  });
});

// ---------------------------------------------------------------------------
// 1c. Rollup External Resolution for @capacitor/preferences
// ---------------------------------------------------------------------------
describe('1c: Rollup External Resolution for @capacitor/preferences', () => {
  it('dist/assets/index-*.js must not contain a dynamic bare import of @capacitor/preferences', () => {
    const assetsDir = path.resolve('dist/assets');
    expect(
      fs.existsSync(assetsDir),
      'dist/assets/ must exist — run npm run build first'
    ).toBe(true);

    const indexBundles = fs.readdirSync(assetsDir).filter(
      (f) => f.startsWith('index-') && f.endsWith('.js')
    );

    expect(
      indexBundles.length,
      'at least one index-*.js bundle must exist in dist/assets/'
    ).toBeGreaterThan(0);

    // Property: no bundle file should contain an unresolved bare import of @capacitor/preferences
    fc.assert(
      fc.property(
        fc.constantFrom(...indexBundles),
        (bundleFile) => {
          const content = fs.readFileSync(path.join(assetsDir, bundleFile), 'utf-8');

          // Check for dynamic import("@capacitor/preferences") — this is the externalized form
          const hasDynamicBareImport = /import\(["']@capacitor\/preferences["']\)/.test(content);

          // Check for static import ... from "@capacitor/preferences"
          const hasStaticBareImport = /from\s+["']@capacitor\/preferences["']/.test(content);

          if (hasDynamicBareImport) {
            console.error(
              `[1c counterexample] ${bundleFile} contains dynamic bare import("@capacitor/preferences") — ` +
              'this will cause a runtime module-not-found error on web because the module is externalized with no shim'
            );
          }
          if (hasStaticBareImport) {
            console.error(
              `[1c counterexample] ${bundleFile} contains static bare import from "@capacitor/preferences"`
            );
          }

          // On web, @capacitor/preferences must be bundled (not externalized as a bare specifier)
          return !hasDynamicBareImport && !hasStaticBareImport;
        }
      ),
      { numRuns: indexBundles.length }
    );
  });
});

// ---------------------------------------------------------------------------
// 1d. GoogleAuth Native Asset Presence
// ---------------------------------------------------------------------------
describe('1d: GoogleAuth Native Asset Presence', () => {
  it('android/app/google-services.json must exist and be non-empty', () => {
    const googleServicesPath = path.resolve('android/app/google-services.json');
    const exists = fs.existsSync(googleServicesPath);

    if (!exists) {
      console.error(
        '[1d counterexample] android/app/google-services.json is ABSENT — ' +
        'build.gradle conditionally skips the Google Services plugin when this file is missing; ' +
        'GoogleAuth will throw at runtime'
      );
    }

    expect(exists, 'android/app/google-services.json must exist for GoogleAuth to work').toBe(true);

    if (exists) {
      const size = fs.statSync(googleServicesPath).size;
      expect(size, 'android/app/google-services.json must be non-empty').toBeGreaterThan(0);
    }
  });

  it('ios/App/App/GoogleService-Info.plist must exist and be non-empty (if iOS project is present)', () => {
    const iosProjectPath = path.resolve('ios');
    const iosProjectExists = fs.existsSync(iosProjectPath);

    if (!iosProjectExists) {
      console.warn('[1d] iOS project not present — skipping iOS GoogleService-Info.plist check');
      return;
    }

    const plistPath = path.resolve('ios/App/App/GoogleService-Info.plist');
    const exists = fs.existsSync(plistPath);

    if (!exists) {
      console.error(
        '[1d counterexample] ios/App/App/GoogleService-Info.plist is ABSENT — ' +
        'GoogleAuth will fail to initialize on iOS'
      );
    }

    expect(exists, 'ios/App/App/GoogleService-Info.plist must exist for GoogleAuth on iOS').toBe(true);

    if (exists) {
      const size = fs.statSync(plistPath).size;
      expect(size, 'ios/App/App/GoogleService-Info.plist must be non-empty').toBeGreaterThan(0);
    }
  });

  it('property: all required GoogleAuth native assets must be present for each configured platform', () => {
    type Platform = { name: string; assetPath: string; projectMarker: string };

    const platforms: Platform[] = [
      {
        name: 'android',
        assetPath: 'android/app/google-services.json',
        projectMarker: 'android',
      },
      {
        name: 'ios',
        assetPath: 'ios/App/App/GoogleService-Info.plist',
        projectMarker: 'ios',
      },
    ];

    // Only check platforms whose native project directory exists
    const activePlatforms = platforms.filter((p) =>
      fs.existsSync(path.resolve(p.projectMarker))
    );

    if (activePlatforms.length === 0) {
      console.warn('[1d] No native platform projects found — skipping asset presence check');
      return;
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...activePlatforms),
        (platform) => {
          const assetPath = path.resolve(platform.assetPath);
          const exists = fs.existsSync(assetPath);
          if (!exists) {
            console.error(
              `[1d counterexample] ${platform.assetPath} is ABSENT for platform '${platform.name}'`
            );
          }
          return exists;
        }
      ),
      { numRuns: activePlatforms.length }
    );
  });
});
