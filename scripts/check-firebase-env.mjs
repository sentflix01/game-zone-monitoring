import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const vars = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

function mergedEnv() {
  const root = process.cwd();
  const fileVars = {
    ...parseEnvFile(path.join(root, '.env')),
    ...parseEnvFile(path.join(root, '.env.local')),
    ...parseEnvFile(path.join(root, '.env.production')),
    ...parseEnvFile(path.join(root, '.env.production.local')),
  };

  return { ...fileVars, ...process.env };
}

if (process.env.SKIP_FIREBASE_ENV_CHECK === '1') {
  console.log('[check:firebase-env] Skipped (SKIP_FIREBASE_ENV_CHECK=1).');
  process.exit(0);
}

const env = mergedEnv();
const missing = REQUIRED_KEYS.filter((key) => !String(env[key] ?? '').trim());

if (missing.length > 0) {
  console.error('[check:firebase-env] Missing required Firebase build variables:');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error('\nSet these values in CI/hosting build environment before deploying.');
  process.exit(1);
}

console.log('[check:firebase-env] Firebase environment looks good.');
