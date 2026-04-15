# Requirements Document

## Introduction

Game Zone is a React + Vite PlayStation game zone manager that currently runs as a web app and PWA. This feature wraps the existing single React codebase into native desktop installers (Windows `.exe`, macOS `.app`) via Electron and native mobile apps (Android `.apk`, iOS `.ipa`) via Capacitor. All data remains local on each device. The web/PWA build is preserved unchanged.

## Glossary

- **App**: The Game Zone application in any of its platform targets.
- **Electron_Main**: The Electron main process that hosts the BrowserWindow and native OS integrations.
- **Electron_Renderer**: The Vite-built React bundle loaded inside the Electron BrowserWindow.
- **Capacitor_Runtime**: The Capacitor native layer that wraps the Vite-built React bundle in a WebView on Android and iOS.
- **Storage_Adapter**: The platform-aware module that routes data persistence calls to the correct storage backend (localStorage for web/Electron, Capacitor Preferences or SQLite for mobile).
- **Auto_Updater**: The Electron component responsible for checking, downloading, and applying application updates.
- **Build_Pipeline**: The set of scripts and CI/CD configuration that produces distributable artifacts for each platform.
- **Platform_Assets**: App icons, splash screens, and metadata required by each target platform.
- **Installer**: A distributable artifact — `.exe` (Windows NSIS), `.dmg`/`.app` (macOS), `.apk` (Android), `.ipa` (iOS).

---

## Requirements

### Requirement 1: Shared React Codebase

**User Story:** As a developer, I want a single React codebase to compile for all platforms, so that features and bug fixes only need to be written once.

#### Acceptance Criteria

1. THE Build_Pipeline SHALL produce web, Electron, Android, and iOS artifacts from the same `src/` directory without modifying React component source files.
2. WHEN the Vite build targets Electron, THE Build_Pipeline SHALL output a static bundle that Electron_Main loads via a local file path (no dev server required at runtime).
3. WHEN the Vite build targets Capacitor, THE Build_Pipeline SHALL output a static bundle that Capacitor_Runtime loads from the app's internal WebView assets.
4. THE App SHALL use `react-router-dom` with `HashRouter` when running inside Electron or Capacitor, and `BrowserRouter` when running as a web/PWA target.

---

### Requirement 2: Electron Desktop App — Windows and macOS

**User Story:** As a user on Windows or macOS, I want to install Game Zone as a native desktop application, so that I can use it without a browser.

#### Acceptance Criteria

1. THE Build_Pipeline SHALL produce a Windows NSIS `.exe` installer and a macOS `.dmg` containing a `.app` bundle using `electron-builder`.
2. WHEN the Electron desktop app is launched, THE Electron_Main SHALL open a `BrowserWindow` that loads the Vite-built React bundle.
3. WHEN the `BrowserWindow` is created, THE Electron_Main SHALL set a minimum window size of 900×600 pixels.
4. THE Electron_Main SHALL enable `contextIsolation` and disable `nodeIntegration` in the `BrowserWindow` webPreferences.
5. WHEN the user closes all windows on macOS, THE Electron_Main SHALL keep the application running in the dock until the user explicitly quits.
6. THE Electron_Main SHALL register a custom application menu that includes standard File, Edit, and View entries appropriate for a desktop app.

---

### Requirement 3: Electron Auto-Updater

**User Story:** As a desktop user, I want the app to update itself automatically, so that I always have the latest version without manual reinstallation.

#### Acceptance Criteria

1. THE Auto_Updater SHALL check for a new release on application startup using `electron-updater`.
2. WHEN a new release is available, THE Auto_Updater SHALL download the update in the background without interrupting the user.
3. WHEN the update download is complete, THE Auto_Updater SHALL notify the user via a native dialog offering to restart and apply the update.
4. IF the update server is unreachable, THEN THE Auto_Updater SHALL log the error and continue normal application operation without displaying an error to the user.
5. THE Auto_Updater SHALL only activate in production builds; development builds SHALL skip the update check.

---

### Requirement 4: Capacitor Mobile App — Android and iOS

**User Story:** As a user on Android or iPhone, I want to install Game Zone as a native mobile app, so that I can manage my game zone from my phone.

#### Acceptance Criteria

1. THE Build_Pipeline SHALL integrate Capacitor and produce an Android Gradle project and an iOS Xcode project from the Vite-built React bundle.
2. WHEN the Capacitor_Runtime initialises on Android, THE App SHALL render the React UI inside a full-screen WebView with no visible browser chrome.
3. WHEN the Capacitor_Runtime initialises on iOS, THE App SHALL render the React UI inside a full-screen WKWebView with no visible browser chrome.
4. THE App SHALL support Android API level 24 (Android 7.0) and above.
5. THE App SHALL support iOS 14 and above.
6. WHEN the device orientation changes, THE App SHALL reflow the React UI to fit the new viewport dimensions without requiring a reload.

---

### Requirement 5: Platform-Aware Data Persistence

**User Story:** As a user on any platform, I want my data to be saved locally on my device, so that my consoles, sessions, and pricing information are always available offline.

#### Acceptance Criteria

1. THE Storage_Adapter SHALL persist data to `localStorage` when the App runs in a web browser or inside Electron_Renderer.
2. WHEN the App runs inside Capacitor_Runtime on Android or iOS, THE Storage_Adapter SHALL persist data using the `@capacitor/preferences` plugin as the primary storage backend.
3. WHEN the App is launched after a previous session, THE Storage_Adapter SHALL restore all Console, Session, and Pricing records that were saved in the previous session.
4. THE Storage_Adapter SHALL expose the same async API (`list`, `filter`, `get`, `create`, `update`, `delete`) regardless of the underlying storage backend, so that no React component requires platform-specific code.
5. IF a read or write operation fails on any storage backend, THEN THE Storage_Adapter SHALL return a rejected Promise with a descriptive error message.
6. THE Storage_Adapter SHALL detect the current platform at runtime and select the appropriate backend without requiring a rebuild.

---

### Requirement 6: Platform Assets — Icons and Splash Screens

**User Story:** As a user installing Game Zone, I want the app to display a proper icon and splash screen on every platform, so that it looks like a polished native application.

#### Acceptance Criteria

1. THE Build_Pipeline SHALL generate all required Electron icon sizes (16×16 to 1024×1024 px) from a single master SVG source.
2. THE Build_Pipeline SHALL generate all required Android adaptive icon sizes and a splash screen image from the master SVG source.
3. THE Build_Pipeline SHALL generate all required iOS icon sizes (20×20 to 1024×1024 px) and a launch storyboard splash screen from the master SVG source.
4. WHEN the Android app is launched, THE Capacitor_Runtime SHALL display the splash screen for no longer than 2000 milliseconds before showing the React UI.
5. WHEN the iOS app is launched, THE Capacitor_Runtime SHALL display the splash screen for no longer than 2000 milliseconds before showing the React UI.
6. THE Platform_Assets SHALL use the existing `public/icon-512.svg` as the master source for all generated icons and splash screens.

---

### Requirement 7: Build Pipeline and Scripts

**User Story:** As a developer, I want a single set of npm scripts to build and package each platform target, so that producing a release is straightforward and repeatable.

#### Acceptance Criteria

1. THE Build_Pipeline SHALL expose the following npm scripts: `build:web`, `build:electron`, `build:android`, `build:ios`, and `package:electron` (which runs `build:electron` then invokes `electron-builder`).
2. WHEN `package:electron` is executed on Windows, THE Build_Pipeline SHALL produce a Windows `.exe` installer in the `release/` directory.
3. WHEN `package:electron` is executed on macOS, THE Build_Pipeline SHALL produce a macOS `.dmg` file in the `release/` directory.
4. WHEN `build:android` is executed, THE Build_Pipeline SHALL copy the Vite output into the Capacitor Android project and run `npx cap sync android`.
5. WHEN `build:ios` is executed, THE Build_Pipeline SHALL copy the Vite output into the Capacitor iOS project and run `npx cap sync ios`.
6. THE Build_Pipeline SHALL not modify or remove the existing `build` (web/PWA) script behaviour.

---

### Requirement 8: Security and Sandboxing

**User Story:** As a security-conscious user, I want the desktop app to follow Electron security best practices, so that the app cannot be exploited through its web content.

#### Acceptance Criteria

1. THE Electron_Main SHALL enable `contextIsolation: true` and `nodeIntegration: false` for all BrowserWindow instances.
2. THE Electron_Main SHALL use a `preload` script to expose only explicitly whitelisted IPC channels to the Electron_Renderer via `contextBridge`.
3. WHEN the Electron_Renderer attempts to open an external URL, THE Electron_Main SHALL open the URL in the system default browser rather than a new Electron window.
4. THE Electron_Main SHALL set a `Content-Security-Policy` header that restricts script sources to `'self'` for production builds.
5. THE Electron_Main SHALL disable the `webSecurity` override; it SHALL remain `true` (the default) in all builds.
