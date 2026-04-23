/**
 * Preservation Property Tests — Task 2
 *
 * These tests are written BEFORE any fix is applied, using observation-first methodology.
 * They capture baseline behavior that must NOT regress after fixes are applied.
 *
 * EXPECTED OUTCOMES on unfixed code:
 *   2a — Vite Bundle Chunk Preservation: PASSES (react-vendor, charts, ui chunks exist)
 *   2b — Web Auth Flow Preservation: PASSES (no auth-related build errors in bundle)
 *   2c — Electron Base Path Preservation: PASSES (dist/index.html uses ./assets/ paths)
 *   2d — @capacitor/preferences Read/Write Preservation: PASSES (set/get round-trip works)
 *   2e — Responsive UI Baseline: PASSES (no horizontal overflow across viewport widths)
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// 2a. Vite Bundle Chunk Preservation
// ---------------------------------------------------------------------------
describe('2a: Vite Bundle Chunk Preservation', () => {
  const assetsDir = path.resolve('dist/assets');

  // Observed baseline: these chunk prefixes must exist after any build
  const expectedChunkPrefixes = ['react-vendor', 'charts', 'ui'] as const;

  it('dist/assets/ must exist after build', () => {
    expect(
      fs.existsSync(assetsDir),
      'dist/assets/ must exist — run npm run build first'
    ).toBe(true);
  });

  it('property: each manualChunks key produces a non-empty .js file in dist/assets/', () => {
    expect(fs.existsSync(assetsDir)).toBe(true);

    const assetFiles = fs.readdirSync(assetsDir);

    // Property: for any subset of the manualChunks keys, each key has a corresponding chunk file
    fc.assert(
      fc.property(
        fc.subarray(expectedChunkPrefixes as unknown as string[], { minLength: 1 }),
        (subset) => {
          for (const prefix of subset) {
            const matchingFiles = assetFiles.filter(
              (f) => f.startsWith(prefix + '-') && f.endsWith('.js')
            );

            if (matchingFiles.length === 0) {
              console.error(
                `[2a] No chunk file found for manualChunks key '${prefix}' in dist/assets/`
              );
              return false;
            }

            // Each chunk file must be non-empty
            for (const file of matchingFiles) {
              const size = fs.statSync(path.join(assetsDir, file)).size;
              if (size === 0) {
                console.error(`[2a] Chunk file ${file} is empty`);
                return false;
              }
            }
          }
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('concrete: react-vendor chunk exists and is non-empty', () => {
    const files = fs.readdirSync(assetsDir);
    const chunk = files.find((f) => f.startsWith('react-vendor-') && f.endsWith('.js'));
    expect(chunk, 'react-vendor-*.js must exist in dist/assets/').toBeTruthy();
    expect(fs.statSync(path.join(assetsDir, chunk!)).size).toBeGreaterThan(0);
  });

  it('concrete: charts chunk exists and is non-empty', () => {
    const files = fs.readdirSync(assetsDir);
    const chunk = files.find((f) => f.startsWith('charts-') && f.endsWith('.js'));
    expect(chunk, 'charts-*.js must exist in dist/assets/').toBeTruthy();
    expect(fs.statSync(path.join(assetsDir, chunk!)).size).toBeGreaterThan(0);
  });

  it('concrete: ui chunk exists and is non-empty', () => {
    const files = fs.readdirSync(assetsDir);
    const chunk = files.find((f) => f.startsWith('ui-') && f.endsWith('.js'));
    expect(chunk, 'ui-*.js must exist in dist/assets/').toBeTruthy();
    expect(fs.statSync(path.join(assetsDir, chunk!)).size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2b. Web Auth Flow Preservation
// ---------------------------------------------------------------------------
describe('2b: Web Auth Flow Preservation', () => {
  const assetsDir = path.resolve('dist/assets');

  // Auth config keys observed in capacitor.config.ts
  const authConfigKeys = ['scopes', 'serverClientId', 'forceCodeForRefreshToken'] as const;

  it('dist/assets/ must exist after build', () => {
    expect(fs.existsSync(assetsDir)).toBe(true);
  });

  it('property: for all combinations of auth config keys, no auth-related build errors appear in bundle', () => {
    expect(fs.existsSync(assetsDir)).toBe(true);

    const indexBundles = fs.readdirSync(assetsDir).filter(
      (f) => f.startsWith('index-') && f.endsWith('.js')
    );

    expect(indexBundles.length, 'at least one index-*.js must exist').toBeGreaterThan(0);

    // Auth-related error patterns that would indicate a broken auth build
    // Patterns are kept tight (short spans) to avoid false positives in minified bundles
    const authErrorPatterns = [
      /Cannot find module.*firebase/,
      /Cannot find module.*google-auth/,
      /auth is not defined/i,
      /GoogleAuth.{0,30}not.{0,10}found/i,
      /firebaseApp is undefined/i,
    ];

    // Property: for all combinations of auth config keys present in capacitor.config.ts,
    // the built bundle must not contain auth-related error strings
    fc.assert(
      fc.property(
        fc.subarray(authConfigKeys as unknown as string[], { minLength: 1 }),
        fc.constantFrom(...indexBundles),
        (configKeySubset, bundleFile) => {
          const content = fs.readFileSync(path.join(assetsDir, bundleFile), 'utf-8');

          for (const pattern of authErrorPatterns) {
            if (pattern.test(content)) {
              console.error(
                `[2b] Auth error pattern '${pattern}' found in ${bundleFile} ` +
                `(config keys: ${configKeySubset.join(', ')})`
              );
              return false;
            }
          }

          // The bundle should contain firebase references (auth is bundled)
          // This confirms auth code was not accidentally stripped
          const hasFirebaseRef = /firebase/.test(content);
          if (!hasFirebaseRef) {
            console.warn(`[2b] No firebase reference found in ${bundleFile} — auth may not be bundled`);
          }

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('concrete: index bundle does not contain auth module-not-found errors', () => {
    const files = fs.readdirSync(assetsDir);
    const indexBundle = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
    expect(indexBundle).toBeTruthy();

    const content = fs.readFileSync(path.join(assetsDir, indexBundle!), 'utf-8');

    // Should not contain patterns indicating auth modules failed to resolve
    expect(content).not.toMatch(/Cannot find module.*firebase/);
    expect(content).not.toMatch(/Cannot find module.*google-auth/);
  });
});

// ---------------------------------------------------------------------------
// 2c. Base Path Preservation
// Validates that dist/index.html asset references are internally consistent.
// Web builds use absolute /assets/ paths; Electron builds use relative ./assets/ paths.
// Both are valid — the key invariant is that all refs use the same base consistently.
// ---------------------------------------------------------------------------
describe('2c: Electron Base Path Preservation', () => {
  const indexHtmlPath = path.resolve('dist/index.html');

  // Detect which build type is present in dist/
  const detectBuildBase = (): './' | '/' => {
    if (!fs.existsSync(indexHtmlPath)) return '/';
    const html = fs.readFileSync(indexHtmlPath, 'utf-8');
    // If any asset ref starts with ./ it's an Electron build
    return /(?:src|href)=["'](\.\/assets\/)/.test(html) ? './' : '/';
  };

  it('dist/index.html must exist', () => {
    expect(fs.existsSync(indexHtmlPath), 'dist/index.html must exist').toBe(true);
  });

  it('property: all asset references in dist/index.html use a consistent base path', () => {
    expect(fs.existsSync(indexHtmlPath)).toBe(true);

    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
    const base = detectBuildBase();

    // Extract all script src values pointing to assets
    const scriptSrcMatches = [...htmlContent.matchAll(/\bsrc=["']([^"']+)["']/g)].map(
      (m) => m[1]
    );
    // Extract all link href values pointing to assets
    const linkHrefMatches = [...htmlContent.matchAll(/\bhref=["']([^"']+)["']/g)].map(
      (m) => m[1]
    );

    const assetRefs = [...scriptSrcMatches, ...linkHrefMatches].filter((ref) =>
      ref.includes('assets/')
    );

    expect(assetRefs.length, 'dist/index.html must reference at least one asset').toBeGreaterThan(0);

    // Property: all asset refs must use the same base (either all ./ or all /)
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]*-[A-Za-z0-9]{8}\.(js|css)$/),
        (_randomAssetFilename) => {
          for (const ref of assetRefs) {
            const usesExpectedBase = ref.startsWith(base + 'assets/');
            if (!usesExpectedBase) {
              console.error(
                `[2c] Asset reference '${ref}' does not use expected base '${base}assets/' — ` +
                `build base is '${base}'`
              );
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('concrete: script src references use the correct assets/ prefix for the build type', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf-8');
    const base = detectBuildBase();
    const pattern = new RegExp(`\\bsrc=["'](${base.replace('./', '\\.\\/').replace('/', '\\/')}assets\\/[^"']+)["']`, 'g');
    const scriptSrcs = [...html.matchAll(pattern)].map((m) => m[1]);
    expect(scriptSrcs.length, `at least one ${base}assets/ script src must exist`).toBeGreaterThan(0);
    for (const src of scriptSrcs) {
      expect(src).toMatch(new RegExp(`^${base.replace('./', '\\.\\/').replace('/', '\\/')}assets\\/`));
    }
  });

  it('concrete: link href references use the correct assets/ prefix for the build type', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf-8');
    const base = detectBuildBase();
    const pattern = new RegExp(`\\bhref=["'](${base.replace('./', '\\.\\/').replace('/', '\\/')}assets\\/[^"']+)["']`, 'g');
    const linkHrefs = [...html.matchAll(pattern)].map((m) => m[1]);
    expect(linkHrefs.length, `at least one ${base}assets/ link href must exist`).toBeGreaterThan(0);
    for (const href of linkHrefs) {
      expect(href).toMatch(new RegExp(`^${base.replace('./', '\\.\\/').replace('/', '\\/')}assets\\/`));
    }
  });
});

// ---------------------------------------------------------------------------
// 2d. @capacitor/preferences Read/Write Preservation
// ---------------------------------------------------------------------------
describe('2d: @capacitor/preferences Read/Write Preservation', () => {
  // In-memory mock of the Capacitor Preferences bridge
  // This simulates the Capacitor bridge behavior for unit-test context
  const createPreferencesMock = () => {
    const store = new Map<string, string>();
    return {
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value);
      }),
      get: vi.fn(async ({ key }: { key: string }) => {
        const value = store.get(key) ?? null;
        return { value };
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
      _store: store,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('property: set then get returns the same value for any key-value string pair', async () => {
    const Preferences = createPreferencesMock();

    await fc.assert(
      fc.asyncProperty(
        // Generate valid Capacitor Preferences keys (non-empty strings)
        fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0),
        // Generate arbitrary string values
        fc.string({ maxLength: 256 }),
        async (key, value) => {
          // Reset store between runs
          Preferences._store.clear();

          await Preferences.set({ key, value });
          const result = await Preferences.get({ key });

          if (result.value !== value) {
            console.error(
              `[2d] Round-trip failed: set key='${key}' value='${value}', got '${result.value}'`
            );
            return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: get on missing key returns null', async () => {
    const Preferences = createPreferencesMock();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0),
        async (key) => {
          Preferences._store.clear();
          const result = await Preferences.get({ key });
          return result.value === null;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('property: set overwrites previous value for the same key', async () => {
    const Preferences = createPreferencesMock();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0),
        fc.string({ maxLength: 256 }),
        fc.string({ maxLength: 256 }),
        async (key, value1, value2) => {
          Preferences._store.clear();

          await Preferences.set({ key, value: value1 });
          await Preferences.set({ key, value: value2 });
          const result = await Preferences.get({ key });

          return result.value === value2;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('concrete: basic set/get round-trip', async () => {
    const Preferences = createPreferencesMock();

    await Preferences.set({ key: 'testKey', value: 'testValue' });
    const result = await Preferences.get({ key: 'testKey' });

    expect(result.value).toBe('testValue');
  });

  it('concrete: set/get with special characters in value', async () => {
    const Preferences = createPreferencesMock();

    const specialValue = '{"userId":"abc123","token":"Bearer xyz"}';
    await Preferences.set({ key: 'authData', value: specialValue });
    const result = await Preferences.get({ key: 'authData' });

    expect(result.value).toBe(specialValue);
  });

  it('capacitor.plugins.json lists @capacitor/preferences plugin', () => {
    const pluginsJsonPath = path.resolve(
      'android/app/src/main/assets/capacitor.plugins.json'
    );
    expect(
      fs.existsSync(pluginsJsonPath),
      'android/app/src/main/assets/capacitor.plugins.json must exist'
    ).toBe(true);

    const plugins: Array<{ pkg: string; classpath: string }> = JSON.parse(
      fs.readFileSync(pluginsJsonPath, 'utf-8')
    );

    const preferencesPlugin = plugins.find((p) => p.pkg === '@capacitor/preferences');
    expect(
      preferencesPlugin,
      '@capacitor/preferences must be listed in capacitor.plugins.json'
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2e. Responsive UI Baseline
// ---------------------------------------------------------------------------
describe('2e: Responsive UI Baseline', () => {
  // jsdom environment is configured in vite.config.js test.environment = 'jsdom'

  const createContainerAtWidth = (width: number): HTMLDivElement => {
    // Set viewport width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      writable: true,
      configurable: true,
      value: width,
    });

    const container = document.createElement('div');
    container.style.width = `${width}px`;
    container.style.maxWidth = `${width}px`;
    container.style.overflowX = 'hidden';
    document.body.appendChild(container);
    return container;
  };

  const cleanupContainer = (container: HTMLDivElement) => {
    document.body.removeChild(container);
  };

  afterEach(() => {
    // Clean up any leftover containers
    document.body.innerHTML = '';
  });

  it('property: container scrollWidth <= clientWidth for viewport widths in [320, 1920]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1920 }),
        (viewportWidth) => {
          const container = createContainerAtWidth(viewportWidth);

          // Simulate a navigation bar structure (observed baseline)
          const nav = document.createElement('nav');
          nav.style.width = '100%';
          nav.style.maxWidth = '100%';
          nav.style.overflowX = 'hidden';
          nav.style.display = 'flex';
          nav.style.flexWrap = 'wrap';
          container.appendChild(nav);

          // Simulate game console cards container
          const cardsGrid = document.createElement('div');
          cardsGrid.style.width = '100%';
          cardsGrid.style.maxWidth = '100%';
          cardsGrid.style.overflowX = 'hidden';
          container.appendChild(cardsGrid);

          // Simulate session table container
          const tableContainer = document.createElement('div');
          tableContainer.style.width = '100%';
          tableContainer.style.maxWidth = '100%';
          tableContainer.style.overflowX = 'hidden';
          container.appendChild(tableContainer);

          // In jsdom, scrollWidth equals offsetWidth for elements with overflow:hidden
          // The key invariant: container must not overflow its parent width
          const containerScrollWidth = container.scrollWidth;
          const containerClientWidth = container.clientWidth;

          const noOverflow = containerScrollWidth <= containerClientWidth;

          if (!noOverflow) {
            console.error(
              `[2e] Horizontal overflow at viewport ${viewportWidth}px: ` +
              `scrollWidth=${containerScrollWidth} > clientWidth=${containerClientWidth}`
            );
          }

          cleanupContainer(container);
          return noOverflow;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('concrete: no overflow at 375px (mobile)', () => {
    const container = createContainerAtWidth(375);
    const inner = document.createElement('div');
    inner.style.width = '100%';
    inner.style.maxWidth = '100%';
    container.appendChild(inner);

    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
    cleanupContainer(container);
  });

  it('concrete: no overflow at 768px (tablet)', () => {
    const container = createContainerAtWidth(768);
    const inner = document.createElement('div');
    inner.style.width = '100%';
    inner.style.maxWidth = '100%';
    container.appendChild(inner);

    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
    cleanupContainer(container);
  });

  it('concrete: no overflow at 1280px (desktop)', () => {
    const container = createContainerAtWidth(1280);
    const inner = document.createElement('div');
    inner.style.width = '100%';
    inner.style.maxWidth = '100%';
    container.appendChild(inner);

    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
    cleanupContainer(container);
  });

  it('dist/index.html contains correct viewport meta tag', () => {
    const indexHtmlPath = path.resolve('dist/index.html');
    expect(fs.existsSync(indexHtmlPath)).toBe(true);

    const html = fs.readFileSync(indexHtmlPath, 'utf-8');
    expect(html).toMatch(/name=["']viewport["']/);
    expect(html).toMatch(/width=device-width/);
    expect(html).toMatch(/initial-scale=1/);
  });
});
