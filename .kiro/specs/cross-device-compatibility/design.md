# Cross-Device Compatibility Bugfix Design

## Overview

The Game Zone app (Capacitor-based, targeting Android, iOS, web/PWA, and Electron) has not been
end-to-end validated across all target platforms. The bug condition is the absence of verified
cross-platform compatibility: the build pipeline, Capacitor plugin configuration, native project
sync, PWA/service worker setup, and responsive UI have not been confirmed to work correctly on
each target. This design formalizes the bug condition, defines the expected correct behavior,
hypothesizes root causes, and outlines a targeted fix and testing strategy.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — any platform target (Android, iOS,
  web/PWA, Electron) where the build, sync, or runtime behavior has not been validated and may
  silently fail or produce incorrect output.
- **Property (P)**: The desired behavior — each platform target builds successfully, launches
  without errors, and renders the UI correctly.
- **Preservation**: Existing functionality on already-working platforms (e.g., web auth, Vite
  bundling, splash screen init) that must remain unchanged after fixes are applied.
- **`capacitor.config.ts`**: Root-level Capacitor configuration file at `capacitor.config.ts`
  that defines `appId`, `webDir`, plugin settings (SplashScreen, GoogleAuth), and
  `androidScheme`.
- **`capacitor.plugins.json`**: Native asset at
  `android/app/src/main/assets/capacitor.plugins.json` listing registered Capacitor plugins for
  the Android runtime.
- **`vite.config.js`**: Vite build configuration at `vite.config.js` that controls PWA manifest,
  service worker (Workbox), asset bundling, and Electron/web base path switching.
- **`build:android`**: npm script that runs `vite build && npx cap sync android`, producing the
  web bundle and syncing it into the Android native project.
- **`build:ios`**: npm script that runs `vite build && npx cap sync ios`, producing the web
  bundle and syncing it into the iOS Xcode project.
- **`@codetrix-studio/capacitor-google-auth`**: Third-party Capacitor plugin for Google
  authentication; requires native configuration (google-services.json on Android,
  GoogleService-Info.plist on iOS).
- **`@capacitor/preferences`**: Official Capacitor plugin for key-value storage; listed in
  `capacitor.plugins.json` but must be verified at runtime.
- **`vite-plugin-pwa`**: Vite plugin that generates the web manifest and Workbox service worker
  for PWA installability.
- **`minSdkVersion`**: Minimum Android API level defined in `android/variables.gradle`,
  controlling the oldest Android version the app supports.

## Bug Details

### Bug Condition

The bug manifests when any of the four platform targets (Android, iOS, web/PWA, Electron) is
built, synced, or run without prior end-to-end validation. The build pipeline may complete
without errors yet produce an artifact that fails at install time, launch time, or runtime due
to misconfigured plugins, missing native assets, incorrect base paths, or unverified responsive
behavior.

**Formal Specification:**
```
FUNCTION isBugCondition(target)
  INPUT: target of type PlatformTarget { android | ios | web | electron }
  OUTPUT: boolean

  RETURN NOT hasBeenValidated(target)
         OR pluginConfigMismatch(target)
         OR nativeSyncIncomplete(target)
         OR pwaBuildInvalid(target)
         OR responsiveUIUntested(target)
END FUNCTION
```

### Examples

- **Android**: `npm run build:android` completes, but the APK fails to launch because
  `google-services.json` is absent and the GoogleAuth plugin throws at init — expected: APK
  installs and launches on `minSdkVersion` and above.
- **iOS**: `npm run build:ios` completes, but the Xcode project fails to compile because
  `GoogleService-Info.plist` is missing or the iOS deployment target is incompatible — expected:
  Xcode project compiles and app launches on supported iOS versions.
- **Web/PWA**: `npm run build` completes, but the service worker fails to register because
  `icon-192.png` and `icon-512.png` are referenced in the manifest but only `.svg` variants
  exist in the project — expected: PWA loads, service worker registers, manifest resolves
  without errors.
- **Electron**: `npm run build:electron` completes, but the app fails to load assets because
  the `base: './'` path is not correctly applied for all asset references — expected: Electron
  app loads all assets via `file://` protocol without 404s.
- **Plugin mismatch**: `capacitor.config.ts` configures `SplashScreen.launchShowDuration: 500`
  but the synced `capacitor.config.json` in `android/app/src/main/assets/` still shows `2000`
  from a stale sync — expected: native config always reflects the root config after sync.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Web platform authentication (Firebase/Google Auth) must continue to work exactly as before.
- Vite asset bundling (JS/CSS chunks, `manualChunks` splitting) must produce no build errors or
  missing module warnings.
- Android splash screen initialization via `@capacitor/core` and `SplashScreen` plugin must
  continue to display on launch as configured.
- iOS splash screen and Capacitor plugin initialization must continue to work as configured in
  the synced `capacitor.config.json`.
- Electron app must continue to function on desktop without regressions from mobile/web changes.
- `@capacitor/preferences` plugin must continue to read/write key-value data on Android.

**Scope:**
All inputs that do NOT involve the unvalidated platform targets should be completely unaffected
by this fix. This includes:
- Existing web-only feature flows (auth, navigation, data display).
- Vite dev server behavior (`npm run dev`).
- Electron dev mode (`npm run dev:electron`).
- Any Radix UI / Tailwind CSS styling that already renders correctly on web.

## Hypothesized Root Cause

Based on the bug description and project structure analysis, the most likely issues are:

1. **Missing Native Auth Assets**: `google-services.json` (Android) and
   `GoogleService-Info.plist` (iOS) may be absent or not committed, causing
   `@codetrix-studio/capacitor-google-auth` to fail at runtime. The `build.gradle` already
   conditionally applies the Google Services plugin only when `google-services.json` exists,
   confirming this is a known risk.

2. **Stale Native Config After Sync**: The `capacitor.config.json` inside
   `android/app/src/main/assets/` shows `launchShowDuration: 2000` while `capacitor.config.ts`
   specifies `500`, indicating the native project may not have been re-synced after config
   changes. `npx cap sync` must be run after every config change.

3. **PWA Icon Format Mismatch**: `vite.config.js` references `icon-192.png` and `icon-512.png`
   in the PWA manifest, but the project contains only `.svg` variants
   (`icon-192.svg`, `icon-512.svg`). This will cause the service worker to fail caching and the
   browser to reject the manifest, breaking PWA installability.

4. **`@capacitor/preferences` Externalized in Rollup**: `vite.config.js` lists
   `@capacitor/preferences` under `rollupOptions.external`, which excludes it from the web
   bundle. On web this is fine if the plugin is shimmed, but on native it must be available via
   the Capacitor bridge. This needs verification to ensure the plugin resolves correctly on all
   targets.

5. **Responsive UI Untested**: No evidence of viewport-specific tests or responsive breakpoint
   validation exists in the project. The app targets mobile (Android/iOS) and desktop
   (Electron/web) but has no documented UI testing across screen sizes.

## Correctness Properties

Property 1: Bug Condition - Platform Build and Runtime Validity

_For any_ platform target where the bug condition holds (isBugCondition returns true — i.e., the
target has not been validated, has a plugin config mismatch, incomplete native sync, invalid PWA
build, or untested responsive UI), the fixed build pipeline and configuration SHALL produce an
artifact that installs successfully, launches without errors, initializes all Capacitor plugins
correctly, and renders the UI without layout breakage on the target platform.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Existing Platform Behavior Unchanged

_For any_ platform target or feature flow where the bug condition does NOT hold (isBugCondition
returns false — i.e., the platform already works correctly), the fixed configuration and code
SHALL produce exactly the same behavior as before, preserving all existing authentication flows,
asset bundling, splash screen behavior, plugin initialization, and Electron desktop
functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `vite.config.js`

**Specific Changes**:
1. **PWA Icon Assets**: Replace `icon-192.png` / `icon-512.png` references in the PWA manifest
   `icons` array with the actual `.svg` files that exist (`icon-192.svg`, `icon-512.svg`), or
   generate proper `.png` variants using the existing `npm run icons` script and commit them.
   Update `includeAssets` accordingly.
2. **Rollup External Audit**: Verify that externalizing `@capacitor/preferences` does not break
   the web build. If the web platform requires a shim, add it; otherwise remove the external
   entry so the plugin is bundled for web and resolved via the bridge on native.

**File**: `capacitor.config.ts`

**Specific Changes**:
3. **Config Sync Enforcement**: After any change to `capacitor.config.ts`, `npx cap sync` must
   be run for all native targets. Add a `postbuild` or `presync` npm script hook to enforce
   this, or document it explicitly in the build pipeline. Verify the synced
   `android/app/src/main/assets/capacitor.config.json` matches the root config after every
   sync.

**File**: `android/app/build.gradle` / Android native project

**Specific Changes**:
4. **Google Services Validation**: Confirm `google-services.json` is present (or document that
   it must be provided per-environment). Add a CI/build-time check that warns when the file is
   absent and GoogleAuth is configured. Verify `minSdkVersion`, `targetSdkVersion`, and
   `compileSdkVersion` in `android/variables.gradle` are compatible with Capacitor 8.x
   requirements.

**File**: iOS native project (`ios/App/`)

**Specific Changes**:
5. **iOS Native Config Verification**: Confirm `GoogleService-Info.plist` is present for
   GoogleAuth. Verify the iOS deployment target in `ios/App/App.xcodeproj` is compatible with
   `@capacitor/ios` 8.x. Confirm `capacitor.config.json` is correctly synced into the iOS
   assets.

**File**: Responsive UI / CSS

**Specific Changes**:
6. **Viewport Meta and Breakpoints**: Verify `index.html` includes the correct viewport meta
   tag. Audit Tailwind CSS breakpoints used in game-critical UI components to ensure they render
   correctly at mobile (360px–428px), tablet (768px–1024px), and desktop (1280px+) widths.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that
demonstrate the bug on the current (unfixed) configuration, then verify the fix works correctly
and preserves existing behavior across all platforms.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing fixes. Confirm or
refute the root cause analysis. If refuted, re-hypothesize.

**Test Plan**: Run the build pipeline for each target and inspect artifacts, logs, and runtime
behavior. Write automated checks that assert the presence and correctness of required config
files and assets.

**Test Cases**:
1. **PWA Manifest Icon Check** (will fail on unfixed code): Assert that all icon `src` paths
   referenced in the Vite PWA manifest exist as actual files in the `dist/` output after
   `npm run build`. Currently `icon-192.png` and `icon-512.png` are referenced but only `.svg`
   variants exist.
2. **Capacitor Config Sync Check** (will fail on unfixed code): Assert that
   `android/app/src/main/assets/capacitor.config.json` matches the values in
   `capacitor.config.ts` after running `npx cap sync android`. Currently `launchShowDuration`
   differs between the two files.
3. **Android Build Pipeline Check** (may fail on unfixed code): Run
   `npm run build:android-apk` and assert the APK is produced without Gradle errors. Inspect
   logcat for plugin initialization errors on a connected device or emulator.
4. **Service Worker Registration Check** (will fail on unfixed code): Load the built PWA in a
   browser and assert the service worker registers successfully (no console errors, SW status
   is `activated`).
5. **Rollup External Resolution Check** (may fail on unfixed code): Assert that
   `@capacitor/preferences` resolves correctly on the web platform after the build (no
   `module not found` errors at runtime).

**Expected Counterexamples**:
- `dist/icon-192.png` does not exist — PWA manifest is invalid.
- `android/app/src/main/assets/capacitor.config.json` has stale `launchShowDuration: 2000`.
- Service worker fails to activate due to missing cached assets.

### Fix Checking

**Goal**: Verify that for all platform targets where the bug condition holds, the fixed
configuration produces the expected behavior.

**Pseudocode:**
```
FOR ALL target WHERE isBugCondition(target) DO
  result := buildAndLaunch_fixed(target)
  ASSERT platformBuildsSuccessfully(result)
  ASSERT pluginsInitializeWithoutErrors(result)
  ASSERT uiRendersCorrectly(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all platform targets and feature flows where the bug condition does NOT
hold, the fixed configuration produces the same result as before.

**Pseudocode:**
```
FOR ALL target WHERE NOT isBugCondition(target) DO
  ASSERT buildAndLaunch_original(target) = buildAndLaunch_fixed(target)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking of
configuration values and asset resolution because:
- It generates many combinations of config values and asserts invariants automatically.
- It catches edge cases (e.g., unusual screen sizes, missing optional config keys) that manual
  tests miss.
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on the current (unfixed) code for web auth, Vite bundling, and
Electron, then write property-based tests capturing those invariants.

**Test Cases**:
1. **Web Auth Preservation**: Verify Firebase/Google Auth flows continue to work after PWA icon
   and manifest fixes — no change to auth logic should occur.
2. **Vite Bundle Preservation**: Verify `manualChunks` output (react-vendor, charts, ui) is
   unchanged after removing `@capacitor/preferences` from externals.
3. **Android Splash Screen Preservation**: Verify splash screen still displays on Android after
   config sync fix — `launchShowDuration` should now correctly reflect `500ms`.
4. **Electron Asset Preservation**: Verify Electron build (`npm run build:electron`) still
   produces a working app with `base: './'` after any vite.config changes.
5. **Preferences Plugin Preservation**: Verify `@capacitor/preferences` read/write operations
   continue to work on Android after any plugin configuration changes.

### Unit Tests

- Test that all PWA manifest icon paths resolve to existing files in `dist/` after build.
- Test that `capacitor.config.json` (synced native asset) matches `capacitor.config.ts` values
  for all configured plugin keys.
- Test that `android/variables.gradle` SDK versions meet Capacitor 8.x minimum requirements.
- Test that `AndroidManifest.xml` declares all required permissions for configured plugins.
- Test that the viewport meta tag is present and correct in `index.html`.

### Property-Based Tests

- Generate random sets of Capacitor plugin config keys and assert that after `cap sync`, the
  native `capacitor.config.json` contains exactly those keys with matching values (no stale
  entries, no missing entries).
- Generate random viewport widths in the range [320px, 1920px] and assert that core UI
  components (navigation, game console cards, session tables) render without overflow or
  clipping.
- Generate random combinations of platform targets and assert that the build script for each
  target produces a non-empty artifact directory without error exit codes.
- Generate random sequences of `@capacitor/preferences` set/get operations and assert that
  values are correctly persisted and retrieved on both web (localStorage shim) and native
  (Capacitor bridge) targets.

### Integration Tests

- Full Android build pipeline: `npm run build:android-apk` → install APK on emulator → launch
  app → assert splash screen displays → assert no plugin errors in logcat.
- Full iOS build pipeline: `npm run build:ios` → open Xcode → build for simulator → launch app
  → assert splash screen displays → assert no plugin errors in Xcode console.
- PWA install flow: `npm run build` → serve `dist/` → open in Chrome → assert service worker
  activates → assert install prompt appears → install PWA → launch from home screen → assert
  app loads correctly.
- Electron smoke test: `npm run build:electron` → `npm run package:electron` → launch packaged
  app → assert all routes load without 404s.
- Responsive UI across breakpoints: Load the built web app at 375px (mobile), 768px (tablet),
  and 1280px (desktop) widths and assert no horizontal scroll, no overlapping elements, and all
  interactive controls are reachable.
