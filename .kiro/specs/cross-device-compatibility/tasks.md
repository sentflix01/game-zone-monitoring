# Implementation Plan

- [x] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - Cross-Platform Build and Config Validity
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **GOAL**: Surface counterexamples that demonstrate each bug condition before any fix is applied
  - **Scoped PBT Approach**: Scope each property to the concrete failing case(s) for reproducibility

  **1a. PWA Icon Format Mismatch (will FAIL on unfixed code)**
  - Use `fast-check` to generate icon entry objects from the manifest and assert each `src` path exists as a real file in `dist/` after `npm run build`
  - Concrete failing case: `dist/icon-192.png` and `dist/icon-512.png` do not exist — only `.svg` variants are present
  - Assert: for all icon entries in `manifest.webmanifest`, `fs.existsSync(path.join('dist', entry.src))` returns `true`
  - Run on UNFIXED code — **EXPECTED OUTCOME**: FAILS with counterexample `{ src: 'icon-192.png' }` not found
  - Document counterexample: `dist/icon-192.png` absent, `dist/icon-512.png` absent

  **1b. Capacitor Config Sync Staleness (will FAIL on unfixed code)**
  - Parse `capacitor.config.ts` values and `android/app/src/main/assets/capacitor.config.json` and assert they match for all shared plugin keys
  - Concrete failing case: `SplashScreen.launchShowDuration` is `500` in `capacitor.config.ts` but `2000` in the synced native JSON
  - Assert: `nativeConfig.plugins.SplashScreen.launchShowDuration === 500`
  - Run on UNFIXED code — **EXPECTED OUTCOME**: FAILS with counterexample `{ key: 'launchShowDuration', expected: 500, actual: 2000 }`
  - Document counterexample: stale `launchShowDuration: 2000` in native asset

  **1c. Rollup External Resolution for @capacitor/preferences (may FAIL on unfixed code)**
  - After `npm run build`, assert that `dist/assets/index-*.js` does NOT contain an unresolved bare import for `@capacitor/preferences`
  - Concrete failing case: `@capacitor/preferences` is listed under `rollupOptions.external` — on web this means the module is excluded from the bundle with no shim, causing a runtime `module not found` error
  - Assert: no `import.*@capacitor/preferences` bare specifier appears unresolved in the built output
  - Run on UNFIXED code — **EXPECTED OUTCOME**: FAILS or warns; document whether runtime error occurs on web

  **1d. GoogleAuth Native Asset Presence (may FAIL on unfixed code)**
  - Assert that `android/app/google-services.json` exists and is non-empty
  - Assert that `ios/App/App/GoogleService-Info.plist` exists and is non-empty (if iOS project is present)
  - Concrete failing case: files are absent — `build.gradle` conditionally skips the Google Services plugin when `google-services.json` is missing, so GoogleAuth will throw at runtime
  - Run on UNFIXED code — **EXPECTED OUTCOME**: FAILS if files are absent; document which assets are missing

  - Mark task complete when all exploration tests are written, run, and failures/counterexamples are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Platform Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology — run UNFIXED code with non-buggy inputs, observe outputs, then encode as properties
  - **GOAL**: Capture baseline behavior that must not regress after fixes are applied

  **2a. Vite Bundle Chunk Preservation**
  - Observe: `npm run build` on unfixed code produces `dist/assets/` with chunks named `react-vendor-*.js`, `charts-*.js`, `ui-*.js`
  - Write property-based test using `fast-check`: generate random subsets of the `manualChunks` keys and assert each named chunk file exists in `dist/assets/` after build
  - Assert: `manualChunks` output (react-vendor, charts, ui) is present and non-empty after any vite.config change
  - Verify test PASSES on UNFIXED code — **EXPECTED OUTCOME**: PASSES (confirms baseline bundle structure)

  **2b. Web Auth Flow Preservation**
  - Observe: Firebase/Google Auth initialization does not throw on web build (no auth-related errors in `dist/assets/index-*.js` console output)
  - Write property-based test: for all combinations of auth config keys present in `capacitor.config.ts` (scopes, serverClientId), assert the web build completes without auth-related build errors
  - Verify test PASSES on UNFIXED code — **EXPECTED OUTCOME**: PASSES

  **2c. Electron Base Path Preservation**
  - Observe: `npm run build:electron` produces `dist/` with `index.html` referencing assets via `./assets/...` relative paths (not `/assets/...`)
  - Write property-based test: generate random asset filenames and assert that when `BUILD_TARGET=electron`, all `<script src>` and `<link href>` values in `dist/index.html` use relative (`./`) paths, not absolute (`/`) paths
  - Verify test PASSES on UNFIXED code — **EXPECTED OUTCOME**: PASSES

  **2d. @capacitor/preferences Read/Write Preservation**
  - Observe: `@capacitor/preferences` set/get operations work on Android via the Capacitor bridge (plugin is listed in `capacitor.plugins.json`)
  - Write property-based test using `fast-check`: generate random key-value string pairs and assert that `Preferences.set({ key, value })` followed by `Preferences.get({ key })` returns the same value — mock the Capacitor bridge for unit-test context
  - Verify test PASSES on UNFIXED code — **EXPECTED OUTCOME**: PASSES

  **2e. Responsive UI Baseline**
  - Observe: core UI components (navigation, game console cards, session tables) render without horizontal overflow at 375px, 768px, and 1280px viewport widths on the current web build
  - Write property-based test using `fast-check`: generate random viewport widths in [320, 1920] and assert that rendered component containers have `scrollWidth <= clientWidth` (no horizontal overflow)
  - Verify test PASSES on UNFIXED code for non-buggy widths — **EXPECTED OUTCOME**: PASSES

  - Mark task complete when all preservation tests are written, run, and confirmed passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix cross-device compatibility issues

  - [x] 3.1 Fix PWA icon format mismatch in vite.config.js
    - Replace `icon-192.png` / `icon-512.png` references in `includeAssets` and `manifest.icons` with the actual `.svg` files (`icon-192.svg`, `icon-512.svg`), OR run `npm run icons` to generate proper `.png` variants and commit them
    - Update `manifest.icons[].type` to `image/svg+xml` if using SVG, or keep `image/png` if generating PNGs
    - Update `apple-touch-icon.png` reference in `includeAssets` to match the actual file present (`apple-touch-icon.svg` per Android assets)
    - Verify `dist/` after build contains the referenced icon files
    - _Bug_Condition: isBugCondition(web) where pwaBuildInvalid(web) = true (icon-192.png / icon-512.png absent from dist/)_
    - _Expected_Behavior: all icon src paths in manifest.webmanifest resolve to existing files in dist/_
    - _Preservation: Vite bundle chunk structure (react-vendor, charts, ui) must remain unchanged_
    - _Requirements: 1.3, 2.3, 3.2_

  - [x] 3.2 Fix stale Capacitor config — re-sync native projects
    - Run `npx cap sync android` (and `npx cap sync ios` if iOS project is present) after confirming `capacitor.config.ts` is correct
    - Verify `android/app/src/main/assets/capacitor.config.json` now shows `launchShowDuration: 500` matching `capacitor.config.ts`
    - Add a `presync` or `postbuild` npm script hook (e.g., `"presync": "vite build"`) to enforce sync after config changes, or document the requirement explicitly in README
    - _Bug_Condition: isBugCondition(android) where nativeSyncIncomplete(android) = true (launchShowDuration mismatch: 500 vs 2000)_
    - _Expected_Behavior: android/app/src/main/assets/capacitor.config.json.plugins.SplashScreen.launchShowDuration === 500_
    - _Preservation: Android splash screen must continue to display on launch; SplashScreen plugin init must remain functional_
    - _Requirements: 1.4, 2.4, 3.3_

  - [x] 3.3 Audit and fix Rollup externals for @capacitor/preferences
    - Determine whether `@capacitor/preferences` needs to be bundled for web or shimmed
    - If the web platform uses the Capacitor bridge shim (window.Capacitor), verify the shim is loaded before the app bundle; otherwise remove `@capacitor/preferences` from `rollupOptions.external` so it is bundled for web
    - Confirm the plugin resolves correctly on Android via `capacitor.plugins.json` (already listed)
    - _Bug_Condition: isBugCondition(web) where pluginConfigMismatch(web) = true (@capacitor/preferences externalized with no web shim)_
    - _Expected_Behavior: @capacitor/preferences resolves without runtime module-not-found error on web and native_
    - _Preservation: @capacitor/preferences read/write operations on Android must continue to work; manualChunks output must remain unchanged_
    - _Requirements: 1.4, 2.4, 3.1, 3.2_

  - [x] 3.4 Verify and document GoogleAuth native asset requirements
    - Confirm whether `android/app/google-services.json` is present; if absent, document that it must be provided per-environment (not committed) and add a build-time warning script
    - Confirm whether `ios/App/App/GoogleService-Info.plist` is present for iOS
    - Verify `minSdkVersion`, `targetSdkVersion`, and `compileSdkVersion` in `android/variables.gradle` meet Capacitor 8.x requirements (minSdk >= 23)
    - Verify `AndroidManifest.xml` declares all permissions required by configured plugins (INTERNET already present; confirm no missing permissions for GoogleAuth)
    - _Bug_Condition: isBugCondition(android) where pluginConfigMismatch(android) = true (google-services.json absent, GoogleAuth throws at init)_
    - _Expected_Behavior: APK installs and launches on minSdkVersion+; GoogleAuth initializes without errors when native assets are present_
    - _Preservation: Existing INTERNET / ACCESS_NETWORK_STATE / VIBRATE permissions must remain; splash screen init must be unaffected_
    - _Requirements: 1.1, 1.4, 2.1, 2.4_

  - [x] 3.5 Validate Android and iOS build pipeline end-to-end
    - Run `npm run build:android-apk` and confirm the APK is produced without Gradle errors
    - Install APK on an emulator or device running `minSdkVersion` and above; confirm app launches and splash screen displays
    - Run `npm run build:ios` and confirm the Xcode project syncs without errors (if iOS environment available)
    - Inspect logcat / Xcode console for any Capacitor plugin initialization errors
    - _Bug_Condition: isBugCondition(android|ios) where hasBeenValidated(target) = false_
    - _Expected_Behavior: platformBuildsSuccessfully(result) AND pluginsInitializeWithoutErrors(result) AND uiRendersCorrectly(result)_
    - _Preservation: Electron build (npm run build:electron) must remain unaffected by any Android/iOS-specific changes_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.5_

  - [x] 3.6 Verify responsive UI across breakpoints
    - Confirm `index.html` includes `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
    - Audit Tailwind CSS breakpoints in game-critical UI components (navigation, console cards, session tables) for mobile (360px–428px), tablet (768px–1024px), and desktop (1280px+)
    - Load built web app at 375px, 768px, and 1280px widths; assert no horizontal scroll, no overlapping elements, all interactive controls reachable
    - _Bug_Condition: isBugCondition(any) where responsiveUIUntested(target) = true_
    - _Expected_Behavior: uiRendersCorrectly(result) at all target viewport widths_
    - _Preservation: Existing Radix UI / Tailwind CSS styling that already renders correctly on web must remain unchanged_
    - _Requirements: 1.5, 2.5, 3.1_

  - [x] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Cross-Platform Build and Config Validity
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior; when they pass, the bugs are fixed
    - Re-run 1a: assert `dist/icon-192.png` (or `.svg`) and `dist/icon-512.png` (or `.svg`) exist after build
    - Re-run 1b: assert `android/app/src/main/assets/capacitor.config.json` has `launchShowDuration: 500`
    - Re-run 1c: assert `@capacitor/preferences` resolves without bare-import error on web build
    - Re-run 1d: assert GoogleAuth native asset presence check passes (or is documented as environment-provided)
    - **EXPECTED OUTCOME**: All exploration tests PASS (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Platform Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Re-run 2a: Vite bundle chunk structure (react-vendor, charts, ui) is unchanged
    - Re-run 2b: Web auth flow produces no auth-related build errors
    - Re-run 2c: Electron build uses relative `./` asset paths in `dist/index.html`
    - Re-run 2d: `@capacitor/preferences` set/get round-trip returns correct values
    - Re-run 2e: Core UI components have no horizontal overflow across [320, 1920] viewport widths
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite: `npx vitest --run`
  - Confirm all exploration tests (Property 1) pass — bugs are fixed
  - Confirm all preservation tests (Property 2) pass — no regressions
  - Confirm `npm run build` completes without errors or warnings about missing assets
  - Confirm `npm run build:android` completes and the synced `capacitor.config.json` matches `capacitor.config.ts`
  - Confirm `npm run build:electron` still produces a working Electron build
  - Ask the user if any questions arise before closing the spec
