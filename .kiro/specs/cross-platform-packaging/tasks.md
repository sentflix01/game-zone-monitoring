# Implementation Plan: Cross-Platform Packaging

## Overview

Wrap the existing Game Zone React + Vite app into native desktop installers (Windows/macOS) via Electron and native mobile apps (Android/iOS) via Capacitor, while preserving the existing web/PWA build. All data remains local on each device via a platform-aware storage adapter.

## Tasks

- [x] 1. Install Electron dependencies
  - Run `npm install --save-dev electron electron-builder electron-updater concurrently wait-on`
  - These are devDependencies since Electron is bundled into the packaged app
  - _Requirements: 2.1, 7.1_

- [x] 2. Create `electron/main.js` — Electron main process
  - [x] 2.1 Create `electron/main.js` with BrowserWindow setup
    - Create a `BrowserWindow` with minimum size 900×600 px
    - Set `contextIsolation: true`, `nodeIntegration: false`, and point `preload` to `electron/preload.js`
    - Load `dist/index.html` via `file://` protocol in production; connect to Vite dev server in dev mode
    - Handle macOS `activate` event to keep app alive in dock after all windows close
    - Open external URLs in the system default browser via `shell.openExternal`
    - Set `Content-Security-Policy` header restricting script sources to `'self'` in production
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 8.1, 8.3, 8.4, 8.5_
  - [x] 2.2 Add application menu to `electron/main.js`
    - Register a custom `Menu` with standard File, Edit, and View entries
    - _Requirements: 2.6_
  - [x] 2.3 Add auto-updater logic to `electron/main.js`
    - Import `autoUpdater` from `electron-updater`
    - Call `autoUpdater.checkForUpdatesAndNotify()` on app `ready`, only when `app.isPackaged` is true
    - Handle `update-downloaded` event: show a native dialog offering to restart and apply
    - Catch errors and log them silently without showing a dialog to the user
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Create `electron/preload.js` — context bridge
  - Use `contextBridge.exposeInMainWorld` to expose only whitelisted IPC channels to the renderer
  - Expose a minimal `electronAPI` object (e.g., `platform` getter, `onUpdateReady` listener)
  - _Requirements: 8.2_

- [x] 4. Update `vite.config.js` for Electron compatibility
  - Add `base: './'` to the Vite config so the built bundle uses relative paths, making it loadable via `file://` protocol inside Electron
  - Ensure the existing PWA plugin and alias config are preserved
  - _Requirements: 1.2_

- [x] 5. Update `src/App.jsx` — platform-aware router
  - Detect the current platform at runtime: check `window.__ELECTRON__` (set by preload) or `window.Capacitor?.isNativePlatform()` to determine if running in Electron or Capacitor
  - Use `HashRouter` when running inside Electron or Capacitor; keep `BrowserRouter` for web/PWA
  - No changes to any Route definitions or child components
  - _Requirements: 1.4_

- [x] 6. Create `src/api/storageAdapter.js` — platform-aware storage
  - [x] 6.1 Implement the storage adapter module
    - Detect platform at runtime: if `window.Capacitor?.isNativePlatform()` is true, use `@capacitor/preferences`; otherwise delegate to `localClient` (localStorage)
    - Expose the same async API as `localClient`: `list`, `filter`, `get`, `create`, `update`, `delete` for each entity (`Console`, `Session`, `Pricing`)
    - For the Capacitor backend, serialize/deserialize the full DB JSON to/from a single Preferences key (same `gamezone_db` key) to match the existing localStorage schema
    - Return a rejected Promise with a descriptive error message on any read/write failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 6.2 Write unit tests for `storageAdapter.js`
    - Test that the localStorage path is selected when `window.Capacitor` is absent
    - Test that the Capacitor Preferences path is selected when `window.Capacitor.isNativePlatform()` returns true
    - Test that `create`, `update`, `delete`, `list`, `filter`, and `get` all resolve correctly on both backends
    - Test that a storage failure returns a rejected Promise with a descriptive message
    - _Requirements: 5.4, 5.5, 5.6_

- [x] 7. Update entity usages to use `storageAdapter` instead of `base44Client`
  - [x] 7.1 Update `src/api/base44Client.js` to re-export from `storageAdapter`
    - Change the re-export so `base44` now points to `storageAdapter` instead of `localClient`
    - This ensures all existing page imports (`base44.entities.*`) automatically use the platform-aware adapter with zero changes to page files
    - _Requirements: 5.4_
  - [x] 7.2 Verify all pages work through the adapter
    - Confirm `Dashboard.jsx`, `Consoles.jsx`, `Sessions.jsx`, `Settings.jsx`, and `Report.jsx` all resolve correctly via the updated `base44Client.js` re-export
    - No direct changes to page files are needed if the re-export approach is used
    - _Requirements: 5.4_

- [x] 8. Add `electron-builder` config to `package.json`
  - Add a top-level `"build"` key with: `appId`, `productName: "Game Zone"`, `directories.output: "release"`, `files` glob including `dist/**` and `electron/**`
  - Add `win` target: `nsis` producing a `.exe` installer
  - Add `mac` target: `dmg` producing a `.dmg` file
  - _Requirements: 2.1, 7.2, 7.3_

- [x] 9. Add npm scripts to `package.json`
  - Add the following scripts:
    - `"build:web"`: `"vite build"` (alias preserving existing behaviour)
    - `"build:electron"`: `"vite build"` (same output, electron-builder picks it up)
    - `"dev:electron"`: `"concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\""`
    - `"package:electron"`: `"npm run build:electron && electron-builder"`
    - `"build:android"`: `"vite build && npx cap sync android"`
    - `"build:ios"`: `"vite build && npx cap sync ios"`
  - Preserve the existing `"build"`, `"dev"`, `"preview"`, `"lint"`, and `"typecheck"` scripts unchanged
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 10. Checkpoint — verify Electron dev mode
  - Run `npm run dev:electron` and confirm the app opens in an Electron window loading the Vite dev server
  - Confirm the window respects the 900×600 minimum size
  - Confirm external links open in the system browser
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 2.2, 2.3, 8.3_

- [x] 11. Install Capacitor dependencies
  - Run `npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/preferences`
  - _Requirements: 4.1, 5.2_

- [x] 12. Configure Capacitor
  - [x] 12.1 Create `capacitor.config.ts`
    - Set `appId` (e.g. `com.gamezone.app`), `appName: "Game Zone"`, `webDir: "dist"`
    - Set `server.androidScheme: "https"` for Android WebView compatibility
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 12.2 Initialize Capacitor project
    - Run `npx cap init "Game Zone" "com.gamezone.app" --web-dir dist` to register the app
    - _Requirements: 4.1_
  - [x] 12.3 Add Android and iOS platforms
    - Run `npx cap add android` to generate the Android Gradle project
    - Run `npx cap add ios` to generate the iOS Xcode project
    - _Requirements: 4.1, 4.4, 4.5_

- [x] 13. Create icon generation script
  - Update `scripts/gen-icons.mjs` (already exists) to use `sharp` or `jimp` to read `public/icon-512.svg` and output:
    - Electron icons: 16, 32, 48, 64, 128, 256, 512, 1024 px PNG files into `build/icons/`
    - Android adaptive icons: all required sizes into `android/app/src/main/res/`
    - iOS icons: all required sizes (20–1024 px) into `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
  - Add an `"icons"` npm script: `"node scripts/gen-icons.mjs"`
  - _Requirements: 6.1, 6.2, 6.3, 6.6_

- [x] 14. Checkpoint — verify production Electron build
  - Run `npm run package:electron` and confirm a `.exe` (Windows) or `.dmg` (macOS) is produced in the `release/` directory
  - Confirm the packaged app loads correctly and data persists across restarts
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 2.1, 7.2, 7.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The `base44Client.js` re-export approach means zero changes are needed in page components
- Capacitor platform detection uses `window.Capacitor?.isNativePlatform()` at runtime — no rebuild required
- Auto-updater only activates when `app.isPackaged` is true, so dev builds are unaffected
- The existing `build` / `dev` / `preview` scripts are preserved unchanged throughout
