#!/usr/bin/env node
/**
 * check-native-assets.mjs
 *
 * Pre-build warning script that checks for required native asset files.
 * These files contain sensitive credentials and must NOT be committed to the repo.
 * They must be provided per-environment (CI secrets, local developer setup).
 *
 * Run automatically via the `prebuild:android` npm script.
 */

import { existsSync } from 'fs';
import { resolve } from 'path';

const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';

const assets = [
  {
    path: 'android/app/google-services.json',
    platform: 'Android',
    description: 'Google Services config for GoogleAuth / Firebase on Android',
    docs: 'https://firebase.google.com/docs/android/setup#add-config-file',
  },
  {
    path: 'ios/App/App/GoogleService-Info.plist',
    platform: 'iOS',
    description: 'Google Services config for GoogleAuth / Firebase on iOS',
    docs: 'https://firebase.google.com/docs/ios/setup#add-config-file',
    optional: true, // only required when iOS project is present
    projectMarker: 'ios',
  },
];

let hasWarnings = false;

for (const asset of assets) {
  // Skip iOS check if iOS project doesn't exist
  if (asset.projectMarker && !existsSync(resolve(asset.projectMarker))) {
    continue;
  }

  if (!existsSync(resolve(asset.path))) {
    hasWarnings = true;
    console.warn(
      `${YELLOW}⚠ WARNING [check-native-assets]${RESET}\n` +
      `  Missing: ${asset.path}\n` +
      `  Platform: ${asset.platform}\n` +
      `  Purpose: ${asset.description}\n` +
      `  This file must be provided per-environment and must NOT be committed to the repo.\n` +
      `  See: ${asset.docs}\n`
    );
  } else {
    console.log(`${GREEN}✓${RESET} ${asset.path} — present`);
  }
}

if (hasWarnings) {
  console.warn(
    `${RED}⚠ One or more native asset files are missing.${RESET}\n` +
    `  The build will proceed, but GoogleAuth will throw at runtime on affected platforms.\n` +
    `  Provide the missing files before deploying to a device or emulator.\n`
  );
  // Exit 0 — warn only, do not block the build
  process.exit(0);
} else {
  console.log(`${GREEN}✓ All required native assets are present.${RESET}`);
}
