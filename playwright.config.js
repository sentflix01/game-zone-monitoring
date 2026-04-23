import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const port = 4173;
const host = '127.0.0.1';
const baseURL = `http://${host}:${port}`;

const hasDist = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
// Skip `npm run build` when re-running locally with a fresh dist/ (e.g. `npm run test:all:fast`).
// Falls back to full build+preview if dist/ is missing.
const useExistingDist = process.env.PW_USE_EXISTING_DIST === '1' && hasDist;
const previewOnly = `npx vite preview --host ${host} --port ${port} --strictPort`;
const buildAndPreview = `npm run build && ${previewOnly}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: useExistingDist ? previewOnly : buildAndPreview,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: useExistingDist ? 60_000 : 180_000,
  },
});
